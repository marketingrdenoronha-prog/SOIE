import { z } from "zod";
import { prisma } from "@soie/db";
import { hashPassword } from "@/server/auth";
import { requireOrgManager } from "@/server/members";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  roleId: z.string().uuid(),
});

/**
 * POST /api/v1/settings/members
 *
 * Adiciona uma pessoa à equipe da organização. Como não há serviço de e-mail, o
 * admin define a senha inicial; a pessoa entra e troca em Configurações. Se o
 * e-mail já existir como usuário (de outra org), reaproveita a conta e apenas
 * cria a membership — sem tocar na senha dela.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const { claims } = await requireOrgManager(req);
    const body = input.parse(await req.json());
    const email = body.email.trim().toLowerCase();

    // Papel precisa pertencer a esta org.
    const role = await prisma.role.findFirst({
      where: { id: body.roleId, organizationId: claims.org },
      select: { id: true },
    });
    if (!role) throw Errors.badRequest("Papel inválido para esta organização.");

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
      const already = await prisma.membership.findFirst({
        where: { organizationId: claims.org, userId },
        select: { id: true },
      });
      if (already) throw Errors.conflict("Essa pessoa já faz parte da equipe.");
    } else {
      const user = await prisma.user.create({
        data: { email, name: body.name.trim(), passwordHash: hashPassword(body.password) },
        select: { id: true },
      });
      userId = user.id;
    }

    const membership = await prisma.membership.create({
      data: {
        organizationId: claims.org,
        userId,
        roleId: body.roleId,
        status: "active",
        invitedBy: claims.sub,
      },
      include: {
        user: { select: { id: true, name: true, email: true, lastLoginAt: true } },
        role: { select: { name: true } },
      },
    });

    return ok({ membership, reusedExistingUser: Boolean(existingUser) }, 201);
  });
}
