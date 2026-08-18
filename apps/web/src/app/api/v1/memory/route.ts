import { prisma } from "@soie/db";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Memory: durable notes the AI always pulls in before generating (editorial
 * line, brand language, guidelines…). Entries are scoped to a project or to the
 * whole organization; the AI context assembles the full hierarchy.
 */

const createInput = z.object({
  scope: z.enum(["project", "org"]).default("project"),
  projectId: z.string().uuid().optional(),
  kind: z.string().min(1).max(60).default("diretriz"),
  content: z.string().min(1).max(4000),
});

/** GET /memory?projectId=… → org-wide entries + that project's entries. */
export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") ?? undefined;

    const where = projectId
      ? {
          organizationId: org,
          OR: [
            { scope: "org" as const, scopeId: org },
            { scope: "project" as const, scopeId: projectId },
          ],
        }
      : { organizationId: org, scope: "org" as const, scopeId: org };

    const memories = await prisma.memory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return ok(memories);
  });
}

/** POST /memory → create an entry (project- or org-scoped). */
export async function POST(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const input = createInput.parse(await req.json());

    let scopeId: string;
    if (input.scope === "project") {
      if (!input.projectId) throw Errors.badRequest("projectId é obrigatório para memória do projeto");
      const project = await prisma.project.findFirst({
        where: { id: input.projectId, organizationId: org },
        select: { id: true },
      });
      if (!project) throw Errors.notFound("Projeto");
      scopeId = project.id;
    } else {
      scopeId = org;
    }

    const memory = await prisma.memory.create({
      data: {
        organizationId: org,
        scope: input.scope,
        scopeId,
        kind: input.kind,
        content: input.content,
      },
    });
    return ok(memory, 201);
  });
}
