import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import * as argon2 from "argon2";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import { env } from "@soie/config";
import type { AuthTokens, LoginInput, RegisterInput } from "@soie/contracts";
import { PrismaService } from "../../common/prisma/prisma.service.js";

/**
 * Registration, login and refresh. On register we create the user, their
 * organization (tenant) and an owner membership atomically, so a new account
 * lands in a fully-formed tenant.
 */
@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: RegisterInput): Promise<AuthTokens> {
    const existing = await this.prisma.client.user.findUnique({
      where: { email: input.email },
    });
    if (existing) throw new ConflictException("Email already registered");

    const passwordHash = await argon2.hash(input.password);
    const slug = slugify(input.organizationName);

    const { user, organization, roles } = await this.prisma.client.$transaction(
      async (tx) => {
        const organization = await tx.organization.create({
          data: { name: input.organizationName, slug: await uniqueSlug(tx, slug) },
        });
        const ownerRole = await tx.role.create({
          data: {
            organizationId: organization.id,
            name: "owner",
            isSystem: true,
            permissions: ["*"],
          },
        });
        const user = await tx.user.create({
          data: { email: input.email, name: input.name, passwordHash },
        });
        await tx.membership.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            roleId: ownerRole.id,
            status: "active",
          },
        });
        return { user, organization, roles: ["owner"] };
      },
    );

    return this.issueTokens(user.id, organization.id, user.email, roles);
  }

  async login(input: LoginInput): Promise<AuthTokens> {
    const user = await this.prisma.client.user.findUnique({
      where: { email: input.email },
      include: { memberships: { include: { role: true } } },
    });
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    const membership = user.memberships.find((m) => m.status === "active");
    if (!membership) throw new UnauthorizedException("No active organization");

    await this.prisma.client.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens(user.id, membership.organizationId, user.email, [
      membership.role.name,
    ]);
  }

  private async issueTokens(
    userId: string,
    org: string,
    email: string,
    roles: string[],
  ): Promise<AuthTokens> {
    const accessToken = jwt.sign({ sub: userId, org, email, roles }, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_TTL,
    });
    const refreshToken = randomBytes(48).toString("hex");
    await this.prisma.client.session.create({
      data: {
        userId,
        organizationId: org,
        refreshTokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL * 1000),
      },
    });
    return { accessToken, refreshToken, expiresIn: env.JWT_ACCESS_TTL };
  }
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function uniqueSlug(tx: any, base: string): Promise<string> {
  let slug = base || "org";
  let n = 0;
  while (await tx.organization.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}
