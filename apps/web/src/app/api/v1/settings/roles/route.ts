import { z } from "zod";
import { prisma } from "@soie/db";
import { requireOrgManager } from "@/server/members";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KNOWN_PERMS = [
  "*",
  "members:manage",
  "clients:manage",
  "editorial:manage",
  "production:manage",
  "review",
] as const;

const input = z.object({
  name: z.string().min(1).max(60),
  permissions: z.array(z.enum(KNOWN_PERMS)).min(1).max(KNOWN_PERMS.length),
});

/**
 * POST /api/v1/settings/roles — cria um papel customizado para a organização.
 * Permissões restritas a um conjunto conhecido para não virar campo livre.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const { claims } = await requireOrgManager(req);
    const body = input.parse(await req.json());
    const name = body.name.trim();

    const clash = await prisma.role.findFirst({
      where: { organizationId: claims.org, name },
      select: { id: true },
    });
    if (clash) throw Errors.conflict("Já existe um papel com esse nome.");

    const role = await prisma.role.create({
      data: {
        organizationId: claims.org,
        name,
        isSystem: false,
        permissions: [...new Set(body.permissions)],
      },
      select: { id: true, name: true, permissions: true, isSystem: true },
    });
    return ok(role, 201);
  });
}
