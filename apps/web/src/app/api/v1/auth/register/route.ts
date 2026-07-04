import { prisma } from "@soie/db";
import { registerInput } from "@soie/contracts";
import { hashPassword, signAccessToken } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Register a user + their organization (tenant) + owner membership atomically. */
export async function POST(req: Request) {
  return handle(async () => {
    const input = registerInput.parse(await req.json());

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw Errors.conflict("E-mail já cadastrado");

    const passwordHash = hashPassword(input.password);
    const base = slugify(input.organizationName);

    // Sem transação interativa (Neon HTTP não suporta). A ordem é dessa forma
    // porque cada passo depende do id do anterior — se falhar no meio, o front
    // recebe o erro e o usuário pode tentar de novo. Slug é único, então
    // retry é seguro.
    const slug = await uniqueSlug(prisma, base);
    const org = await prisma.organization.create({
      data: { name: input.organizationName, slug },
    });
    const role = await prisma.role.create({
      data: { organizationId: org.id, name: "owner", isSystem: true, permissions: ["*"] },
    });
    const user = await prisma.user.create({
      data: { email: input.email, name: input.name, passwordHash },
    });
    await prisma.membership.create({
      data: { organizationId: org.id, userId: user.id, roleId: role.id, status: "active" },
    });

    return ok(
      signAccessToken({ sub: user.id, org: org.id, email: user.email, roles: ["owner"] }),
      201,
    );
  });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "org";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function uniqueSlug(tx: any, base: string): Promise<string> {
  let slug = base;
  let n = 0;
  while (await tx.organization.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}
