/**
 * Reset one-shot de senha (executado no build do Vercel, que tem DATABASE_URL).
 *
 * Segurança: o repositório guarda APENAS o hash scrypt (irreversível), nunca a
 * senha em texto. Este arquivo é TEMPORÁRIO — é removido logo após o deploy que
 * aplica o reset, para não sobrescrever a senha em deploys futuros.
 *
 * Roda com: pnpm --filter @soie/db exec tsx prisma/seed-reset.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// email → hash scrypt (formato scrypt$salt$hash), gerado com o mesmo algoritmo
// do login (apps/web/src/server/auth.ts). Não contém a senha em texto.
const RESETS: Array<{ email: string; passwordHash: string }> = [
  {
    email: "marco@beam360.com.br",
    passwordHash:
      "scrypt$4e68fd5ede4fc8d0136bb1275228bdf6$cf2618f41a19b4c81ab36410010e6247baf58e3dd61ea6de56008e514de7fc5fca1c99dc30079a9cfd53f454a5a484a88eb7ab656fdadb8ec0cb8a55cfc0f8af",
  },
];

async function main() {
  for (const r of RESETS) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: r.email, mode: "insensitive" } },
      select: { id: true, email: true },
    });
    if (!user) {
      console.log(`⚠ reset: usuário ${r.email} não encontrado — pulando`);
      continue;
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: r.passwordHash } });
    console.log(`✓ reset: senha redefinida para ${user.email}`);
  }
}

main()
  .catch((e) => { console.error("reset seed error", e); })
  .finally(async () => { await prisma.$disconnect(); });
