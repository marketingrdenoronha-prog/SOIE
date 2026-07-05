import { z } from "zod";
import { prisma } from "@soie/db";
import { requireAuth, verifyPassword, hashPassword } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "A nova senha precisa de ao menos 8 caracteres"),
});

/** Change the logged-in user's password (verifies the current one first). */
export async function POST(req: Request) {
  return handle(async () => {
    const { sub } = requireAuth(req);
    const input = body.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user) throw Errors.notFound("Usuário");
    if (!verifyPassword(input.currentPassword, user.passwordHash)) {
      throw Errors.badRequest("Senha atual incorreta");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(input.newPassword) },
    });
    return ok({ ok: true });
  });
}
