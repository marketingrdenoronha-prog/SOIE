import { prisma } from "@soie/db";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { runAgent } from "@/server/ai-runtime";
import { assembleProjectContext } from "@/server/project-context";
import { resolveDefaultProjectId } from "@/server/client-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createInput = z.object({
  brief: z.string().max(4000).optional(),
});

/** GET /clients/:id/editorial-strategies
 * Lists every editorial strategy version for a client (newest first). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id: clientId } = await params;
    await ensureClient(org, clientId);

    const strategies = await prisma.editorialStrategy.findMany({
      where: { organizationId: org, clientId },
      include: {
        editorialLines: { include: { categories: { include: { themes: true } } } },
        reviewLinks: { orderBy: { createdAt: "desc" }, take: 1 },
        reviewComments: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    });
    return ok(strategies);
  });
}

/** POST /clients/:id/editorial-strategies
 * Generates a new version. It never overwrites an old strategy: the latest
 * strategy becomes parentStrategyId and the agent receives prior strategies +
 * client feedback via assembleProjectContext. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id: clientId } = await params;
    const input = createInput.parse(await req.json().catch(() => ({})));
    const client = await ensureClient(org, clientId);
    const projectId = await resolveDefaultProjectId(clientId, org);

    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: org },
      include: { brand: true, personas: { include: { pains: true, desires: true } } },
    });
    if (!project) throw Errors.notFound("Projeto");

    const previous = await prisma.editorialStrategy.findFirst({
      where: { organizationId: org, clientId },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      include: { reviewComments: { orderBy: { createdAt: "desc" }, take: 3 } },
    });

    const nextVersion = (previous?.version ?? 0) + 1;
    const feedback = previous?.reviewComments
      ?.filter((c) => c.decision === "request_changes" && c.comment)
      .map((c) => c.comment)
      .join("\n");

    const context = await assembleProjectContext(org, projectId);
    const result = await runAgent("planning", {
      brand: project.brand.name,
      client: client.name,
      positioning: project.brand.positioning,
      objectives: project.brand.objectives,
      personas: project.personas.map((p) => ({ name: p.name, pains: p.pains.map((x) => x.description) })),
      version: nextVersion,
      parentStrategyId: previous?.id,
      clientFeedback: feedback || undefined,
      brief: [input.brief, feedback ? `Feedback do cliente na versão anterior:\n${feedback}` : ""]
        .filter(Boolean)
        .join("\n\n"),
    }, context);

    const strategy = await prisma.editorialStrategy.create({
      data: {
        organizationId: org,
        clientId,
        projectId,
        version: nextVersion,
        parentStrategyId: previous?.id,
        positioning: result.positioning,
        pillars: result.pillars ?? [],
        objectives: result.objectives ?? {},
        rationale: result.rationale,
        confidence: (result.confidence as "high" | "medium" | "low") ?? "medium",
        status: "draft",
        editorialLines: {
          create: (result.lines ?? []).map((line: {
            name: string; objective: string; funnelStage: string; platforms?: string[]; categories?: { name: string; themes?: { title: string; channel?: string; format?: string; copy?: unknown }[] }[];
          }) => ({
            organizationId: org,
            name: line.name,
            objective: line.objective as never,
            funnelStage: line.funnelStage as never,
            platforms: line.platforms ?? [],
            categories: {
              create: (line.categories ?? []).map((cat) => ({
                organizationId: org,
                name: cat.name,
                themes: {
                  create: (cat.themes ?? []).map((t, i) => ({
                    organizationId: org,
                    title: t.title,
                    channel: t.channel,
                    format: t.format,
                    copy: (t.copy ?? undefined) as never,
                    priority: i,
                  })),
                },
              })),
            },
          })),
        },
      },
      include: {
        editorialLines: { include: { categories: { include: { themes: true } } } },
        reviewLinks: true,
        reviewComments: true,
      },
    });
    return ok(strategy, 201);
  });
}

async function ensureClient(organizationId: string, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!client) throw Errors.notFound("Cliente");
  return client;
}
