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

    const { user, org } = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: input.organizationName, slug: await uniqueSlug(tx, base) },
      });
      const role = await tx.role.create({
        data: { organizationId: org.id, name: "owner", isSystem: true, permissions: ["*"] },
      });
      const user = await tx.user.create({
        data: { email: input.email, name: input.name, passwordHash },
      });
      await tx.membership.create({
        data: { organizationId: org.id, userId: user.id, roleId: role.id, status: "active" },
      });
      return { user, org };
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
