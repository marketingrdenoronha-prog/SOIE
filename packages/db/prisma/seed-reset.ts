/**
 * Seed one-shot de reset de senha — define a senha do marco@beam360.com.br.
 *
 * Segurança: a senha em TEXTO nunca aparece aqui — só o hash scrypt (mesmo
 * formato do server: scrypt$<salt>$<hash>). Roda no build da Vercel (que tem
 * DATABASE_URL), aplica a senha e é REMOVIDO em seguida para não sobrescrever a
 * senha a cada deploy. Match de e-mail case-insensitive.
 *
 * Roda com: pnpm --filter @soie/db exec tsx prisma/seed-reset.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMAIL = "marco@beam360.com.br";
// Hash de scrypt (salt aleatório) da senha escolhida pelo dono da conta.
const PASSWORD_HASH =
  "scrypt$d81fd0b37e2fb141fca81a67ac01c734$a7507d620dba8f1dfe6d5034041a5a9bb2397c65b882eb6e87615ebe90753b9349ee74bd25fac16a9aee00a02c39b7cbd73549b07c4ed2bb864a154630e99293";

async function main() {
  const res = await prisma.user.updateMany({
    where: { email: { equals: EMAIL, mode: "insensitive" } },
    data: { passwordHash: PASSWORD_HASH },
  });
  if (res.count > 0) {
    console.log(`[seed:reset] senha atualizada para ${EMAIL} (${res.count} conta).`);
  } else {
    console.log(`[seed:reset] nenhuma conta encontrada com ${EMAIL} — nada a fazer.`);
  }
}

main()
  .catch((e) => {
    console.error("[seed:reset] falhou:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
