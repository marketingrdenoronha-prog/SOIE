import { prisma } from "@soie/db";
import { loginInput } from "@soie/contracts";
import { verifyPassword, signAccessToken } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async () => {
    const input = loginInput.parse(await req.json());

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { memberships: { where: { status: "active" }, include: { role: true } } },
    });
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw Errors.unauthorized();
    }
    const membership = user.memberships[0];
    if (!membership) throw Errors.unauthorized();

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return ok(
      signAccessToken({
        sub: user.id,
        org: membership.organizationId,
        email: user.email,
        roles: [membership.role.name],
      }),
    );
  });
}
