import { prisma } from "@soie/db";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";
import { runAgent } from "@/server/ai-runtime";
import { assembleProjectContext } from "@/server/project-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const generateInput = z.object({
  projectId: z.string().uuid(),
  brief: z.string().max(2000).optional(),
});

export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") ?? undefined;
    const strategies = await prisma.editorialStrategy.findMany({
      where: { organizationId: org, ...(projectId ? { projectId } : {}) },
      include: {
        editorialLines: { include: { categories: { include: { themes: true } } } },
        project: { select: { name: true, brand: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return ok(strategies);
  });
}

/** Generate an editorial strategy + lines from the project's context. */
export async function POST(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const input = generateInput.parse(await req.json());
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, organizationId: org },
      include: { brand: true, personas: { include: { pains: true, desires: true } } },
    });
    if (!project) throw new Error("Projeto não encontrado");

    // Editorial line synthesizes everything already gathered (Constitution:
    // strategy comes after understanding), so it gets the full project context.
    const context = await assembleProjectContext(org, input.projectId);
    const result = await runAgent("planning", {
      brand: project.brand.name,
      positioning: project.brand.positioning,
      objectives: project.brand.objectives,
      personas: project.personas.map((p) => ({ name: p.name, pains: p.pains.map((x) => x.description) })),
      brief: input.brief,
    }, context, { organizationId: org });

    const strategy = await prisma.editorialStrategy.create({
      data: {
        organizationId: org,
        projectId: input.projectId,
        positioning: result.positioning,
        pillars: result.pillars ?? [],
        objectives: result.objectives ?? {},
        rationale: result.rationale,
        confidence: (result.confidence as "high" | "medium" | "low") ?? "medium",
        status: "draft",
        editorialLines: {
          create: (result.lines ?? []).map((line: {
            name: string; objective: string; funnelStage: string; platforms?: string[]; categories?: { name: string; themes?: { title: string }[] }[];
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
                    organizationId: org, title: t.title, priority: i,
                  })),
                },
              })),
            },
          })),
        },
      },
      include: {
        editorialLines: { include: { categories: { include: { themes: true } } } },
      },
    });
    return ok(strategy, 201);
  });
}
