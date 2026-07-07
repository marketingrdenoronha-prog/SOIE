import { prisma } from "@soie/db";
import { requireAuth } from "./auth";
import { Errors } from "./http";
import type { JwtClaims } from "@soie/contracts";

/**
 * Papéis padrão de uma organização SOIE. Semeados sob demanda (idempotente) para
 * que o admin já tenha o que escolher ao adicionar equipe. `permissions` é uma
 * lista simples de strings; "*" = tudo (dono).
 */
export const DEFAULT_ROLES: Array<{ name: string; permissions: string[]; isSystem: boolean }> = [
  { name: "owner", permissions: ["*"], isSystem: true },
  { name: "admin", permissions: ["members:manage", "clients:manage", "editorial:manage", "production:manage"], isSystem: true },
  { name: "editor", permissions: ["clients:manage", "editorial:manage", "production:manage"], isSystem: true },
  { name: "designer", permissions: ["production:manage"], isSystem: true },
  { name: "audiovisual", permissions: ["production:manage"], isSystem: true },
  { name: "cliente", permissions: ["review"], isSystem: true },
];

/** Garante que a org tenha o conjunto base de papéis. Idempotente. */
export async function ensureDefaultRoles(organizationId: string): Promise<void> {
  const existing = await prisma.role.findMany({
    where: { organizationId },
    select: { name: true },
  });
  const have = new Set(existing.map((r) => r.name));
  const missing = DEFAULT_ROLES.filter((r) => !have.has(r.name));
  if (missing.length === 0) return;
  await prisma.role.createMany({
    data: missing.map((r) => ({
      organizationId,
      name: r.name,
      isSystem: r.isSystem,
      permissions: r.permissions,
    })),
    skipDuplicates: true,
  });
}

function hasPerm(permissions: unknown, perm: string): boolean {
  return Array.isArray(permissions) && (permissions.includes("*") || permissions.includes(perm));
}

/**
 * Exige que o chamador seja membro ativo da org E tenha permissão de gerenciar
 * equipe ("*" ou "members:manage"). Devolve as claims + a membership do chamador.
 */
export async function requireOrgManager(
  req: Request,
): Promise<{ claims: JwtClaims; membershipId: string }> {
  const claims = requireAuth(req);
  const me = await prisma.membership.findFirst({
    where: { organizationId: claims.org, userId: claims.sub },
    include: { role: { select: { permissions: true } } },
  });
  if (!me || me.status !== "active") throw Errors.forbidden();
  if (!hasPerm(me.role.permissions, "members:manage")) throw Errors.forbidden();
  return { claims, membershipId: me.id };
}

/**
 * Conta quantos donos ATIVOS (papel com "*") a org tem — usado para impedir que
 * a última conta dona seja removida, rebaixada ou suspensa (org sem dono).
 */
export async function activeOwnerCount(organizationId: string): Promise<number> {
  const rows = await prisma.membership.findMany({
    where: { organizationId, status: "active" },
    select: { role: { select: { permissions: true } } },
  });
  return rows.filter((r) => hasPerm(r.role.permissions, "*")).length;
}
