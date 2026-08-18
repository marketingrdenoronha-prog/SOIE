import { z } from "zod";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ensureDefaultRoles } from "@/server/members";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Organization overview: org info, members, roles e as permissões do chamador. */
export async function GET(req: Request) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    // Garante o conjunto base de papéis (owner/admin/editor/designer/…) antes de
    // listar, para que a tela de equipe sempre tenha o que escolher.
    await ensureDefaultRoles(org);

    const [organization, memberships, roles] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: org },
        select: {
          id: true, name: true, slug: true, status: true, byokEnabled: true, createdAt: true,
        },
      }),
      prisma.membership.findMany({
        where: { organizationId: org },
        include: {
          user: { select: { id: true, name: true, email: true, lastLoginAt: true } },
          role: { select: { id: true, name: true, permissions: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.role.findMany({
        where: { organizationId: org },
        orderBy: { name: "asc" },
        select: { id: true, name: true, permissions: true, isSystem: true },
      }),
    ]);

    // Permissões do próprio usuário logado — a UI usa para mostrar/ocultar os
    // controles de gestão de equipe.
    const me = memberships.find((m) => m.user.id === sub);
    const myPermissions = Array.isArray(me?.role?.permissions) ? (me!.role!.permissions as string[]) : [];
    const canManageMembers = myPermissions.includes("*") || myPermissions.includes("members:manage");

    return ok({ organization, memberships, roles, myPermissions, canManageMembers, meId: sub });
  });
}

const patchBody = z.object({
  name: z.string().min(1).max(200).optional(),
  byokEnabled: z.boolean().optional(),
});

/** Update organization settings (name, BYOK toggle). */
export async function PATCH(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const input = patchBody.parse(await req.json());
    const organization = await prisma.organization.update({
      where: { id: org },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.byokEnabled !== undefined ? { byokEnabled: input.byokEnabled } : {}),
      },
      select: { id: true, name: true, slug: true, status: true, byokEnabled: true, createdAt: true },
    });
    return ok(organization);
  });
}
