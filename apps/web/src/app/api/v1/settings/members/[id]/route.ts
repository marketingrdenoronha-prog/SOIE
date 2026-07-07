import { z } from "zod";
import { prisma } from "@soie/db";
import { requireOrgManager, activeOwnerCount } from "@/server/members";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = z.string().uuid();
const patchBody = z.object({
  roleId: z.string().uuid().optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

function isOwnerRole(permissions: unknown): boolean {
  return Array.isArray(permissions) && permissions.includes("*");
}

/** Carrega a membership do alvo dentro da org do chamador. */
async function loadTarget(membershipId: string, org: string) {
  const m = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId: org },
    include: { role: { select: { permissions: true } } },
  });
  if (!m) throw Errors.notFound("Membro");
  return m;
}

/**
 * PATCH /api/v1/settings/members/:id — muda o papel e/ou o status (ativar/
 * suspender) de um membro. Protege a última conta dona: não deixa rebaixá-la
 * nem suspendê-la (org ficaria sem dono).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { claims } = await requireOrgManager(req);
    const { id } = await params;
    if (!uuid.safeParse(id).success) throw Errors.notFound("Membro");
    const body = patchBody.parse(await req.json());
    if (body.roleId === undefined && body.status === undefined) {
      throw Errors.badRequest("Nada para atualizar.");
    }

    const target = await loadTarget(id, claims.org);
    const targetIsOwner = isOwnerRole(target.role.permissions);

    // Se o alvo é dono e a mudança tira o status de dono ativo, checa se sobra
    // pelo menos um outro dono ativo.
    if (targetIsOwner) {
      const demoting =
        body.status === "disabled" ||
        (body.roleId !== undefined &&
          !isOwnerRole(
            (
              await prisma.role.findFirst({
                where: { id: body.roleId, organizationId: claims.org },
                select: { permissions: true },
              })
            )?.permissions,
          ));
      if (demoting && (await activeOwnerCount(claims.org)) <= 1) {
        throw Errors.badRequest("A organização precisa de pelo menos um dono ativo.");
      }
    }

    if (body.roleId !== undefined) {
      const role = await prisma.role.findFirst({
        where: { id: body.roleId, organizationId: claims.org },
        select: { id: true },
      });
      if (!role) throw Errors.badRequest("Papel inválido para esta organização.");
    }

    const membership = await prisma.membership.update({
      where: { id: target.id },
      data: {
        ...(body.roleId !== undefined ? { role: { connect: { id: body.roleId } } } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, lastLoginAt: true } },
        role: { select: { name: true } },
      },
    });
    return ok(membership);
  });
}

/**
 * DELETE /api/v1/settings/members/:id — remove o membro da organização (o
 * usuário continua existindo, só perde o acesso a esta org). Não permite remover
 * a última conta dona.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { claims } = await requireOrgManager(req);
    const { id } = await params;
    if (!uuid.safeParse(id).success) throw Errors.notFound("Membro");

    const target = await loadTarget(id, claims.org);
    if (
      isOwnerRole(target.role.permissions) &&
      target.status === "active" &&
      (await activeOwnerCount(claims.org)) <= 1
    ) {
      throw Errors.badRequest("Não é possível remover o único dono ativo da organização.");
    }

    await prisma.membership.delete({ where: { id: target.id } });
    return ok({ removed: true, id: target.id });
  });
}
