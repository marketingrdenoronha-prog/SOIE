import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@soie/db";
import { env } from "@soie/config";
import { hashPassword } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({
  email: z.string().email(),
  newPassword: z.string().min(8).max(200),
  secret: z.string().min(1),
});

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * POST /api/v1/auth/admin-reset
 *
 * Redefinição administrativa de senha por e-mail — funciona mesmo trancado para
 * fora (sem estar logado). Protegida pelo segredo ADMIN_RESET_SECRET: se a env
 * não estiver definida, a rota fica DESLIGADA (404), então não é uma porta
 * aberta. Não há serviço de e-mail configurado, por isso o reset é feito com o
 * segredo de administrador em vez de link enviado por e-mail.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const secretEnv = env.ADMIN_RESET_SECRET;
    // Desligada quando não há segredo configurado no ambiente.
    if (!secretEnv || secretEnv.length < 8) throw Errors.notFound("Recurso");

    const { email, newPassword, secret } = input.parse(await req.json());
    if (!safeEqual(secret, secretEnv)) throw Errors.unauthorized();

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw Errors.notFound("Usuário");

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(newPassword) },
    });

    return ok({ reset: true, email });
  });
}
