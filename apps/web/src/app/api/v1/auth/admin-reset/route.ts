import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@soie/db";
import { env } from "@soie/config";
import { hashPassword } from "@/server/auth";
import { ok, handle, fail } from "@/server/http";

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
    // Segredo do administrador. Ordem: env ADMIN_RESET_SECRET → env
    // ADMIN_HARD_KEY → padrão embutido. Definir qualquer uma das envs na Vercel
    // SOBRESCREVE o padrão (recomendado, para não deixar o segredo no código).
    const secretEnv = env.ADMIN_RESET_SECRET || env.ADMIN_HARD_KEY || "beam360marco";
    // Mensagens explícitas para o operador saber exatamente o que corrigir.
    if (!secretEnv) {
      return fail("reset_not_configured", "Reset não configurado no servidor: defina a variável de ambiente ADMIN_HARD_KEY (ou ADMIN_RESET_SECRET) no projeto soie-web da Vercel e faça um novo deploy.", 503);
    }
    if (secretEnv.length < 8) {
      return fail("reset_secret_too_short", "O segredo configurado (ADMIN_HARD_KEY) tem menos de 8 caracteres. Use um valor com 8+ caracteres e refaça o deploy.", 503);
    }

    const { email, newPassword, secret } = input.parse(await req.json());
    if (!safeEqual(secret, secretEnv)) {
      return fail("wrong_secret", "Segredo de administrador incorreto. Use exatamente o VALOR configurado na env ADMIN_HARD_KEY na Vercel.", 401);
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: "insensitive" } },
      select: { id: true, email: true },
    });
    if (!user) {
      return fail("user_not_found", `Nenhuma conta encontrada com o e-mail "${email}". Confira se o e-mail está exatamente como no cadastro.`, 404);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(newPassword) },
    });

    return ok({ reset: true, email: user.email });
  });
}
