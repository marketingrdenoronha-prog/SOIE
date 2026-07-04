import { prisma } from "@soie/db";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";
import { runAgent } from "@/server/ai-runtime";
import { assembleProjectContext } from "@/server/project-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startInput = z.object({
  projectId: z.string().uuid(),
  brief: z.string().max(2000).optional(),
});

export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") ?? undefined;
    const [researches, competitors, analyses] = await Promise.all([
      prisma.research.findMany({
        where: { organizationId: org, ...(projectId ? { projectId } : {}) },
        orderBy: { createdAt: "desc" }, take: 20,
      }),
      prisma.competitor.findMany({
        where: { organizationId: org, ...(projectId ? { projectId } : {}) },
        orderBy: { name: "asc" }, take: 50,
      }),
      prisma.marketAnalysis.findMany({
        where: { organizationId: org, ...(projectId ? { projectId } : {}) },
        orderBy: { createdAt: "desc" }, take: 10,
      }),
    ]);
    return ok({ researches, competitors, analyses });
  });
}

/** Run market + competition agents and persist their outputs. */
export async function POST(req: Request) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    const input = startInput.parse(await req.json());
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, organizationId: org }, include: { brand: true },
    });
    if (!project) throw new Error("Projeto não encontrado");

    const research = await prisma.research.create({
      data: {
        organizationId: org, projectId: input.projectId, type: "full",
        status: "running", createdBy: sub, params: { brief: input.brief ?? "" },
      },
    });

    // Any failure below (AI provider, parsing, persistence) must not leave the
    // research stuck on "running" forever — record it as "failed" with the
    // error message so the UI can surface it and the user can retry.
    try {
      const context = await assembleProjectContext(org, input.projectId);
      const [market, competition] = await Promise.all([
        runAgent("market", { brand: project.brand.name, positioning: project.brand.positioning, brief: input.brief }, context),
        runAgent("competition", { brand: project.brand.name, positioning: project.brand.positioning, brief: input.brief }, context),
      ]);

      await Promise.all([
        prisma.marketAnalysis.create({
          data: {
            organizationId: org, projectId: input.projectId, researchId: research.id,
            swot: market.swot ?? {}, trends: market.trends ?? [],
            opportunities: market.opportunities ?? [], threats: market.threats ?? [],
            confidence: (market.confidence as "high" | "medium" | "low") ?? "medium",
          },
        }),
        prisma.competitor.createMany({
          data: (competition.competitors ?? []).map((c: {
            name: string; url?: string; positioning?: string; strengths?: string[]; weaknesses?: string[];
          }) => ({
            organizationId: org, projectId: input.projectId, researchId: research.id,
            name: c.name, url: c.url, positioning: c.positioning,
            strengths: c.strengths ?? [], weaknesses: c.weaknesses ?? [],
          })),
        }),
      ]);

      await prisma.research.update({
        where: { id: research.id },
        data: {
          status: "succeeded",
          summary: { market: market.summary, competitors: (competition.competitors ?? []).length },
          confidence: (market.confidence as "high" | "medium" | "low") ?? "medium",
        },
      });

      return ok({ researchId: research.id, status: "succeeded" }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.research.update({
        where: { id: research.id },
        data: { status: "failed", summary: { error: message } },
      });
      throw err;
    }
  });
}
