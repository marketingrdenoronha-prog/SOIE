import { prisma } from "@soie/db";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";
import { runAgent } from "@/server/ai-runtime";
import { assembleProjectContext } from "@/server/project-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createInput = z.object({
  projectId: z.string().uuid(),
  brief: z.string().max(2000).optional(),
});

export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") ?? undefined;
    const personas = await prisma.persona.findMany({
      where: { organizationId: org, ...(projectId ? { projectId } : {}) },
      include: { pains: true, objections: true, desires: true, project: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return ok(personas);
  });
}

/** Generate a persona via AI agent, then persist. */
export async function POST(req: Request) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    const input = createInput.parse(await req.json());
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, organizationId: org },
      include: { brand: true },
    });
    if (!project) throw new Error("Projeto não encontrado");

    const context = await assembleProjectContext(org, input.projectId);
    const result = await runAgent("persona", {
      brand: project.brand.name,
      positioning: project.brand.positioning,
      goal: project.goal,
      brief: input.brief,
    }, context, { organizationId: org });

    const persona = await prisma.persona.create({
      data: {
        organizationId: org,
        projectId: input.projectId,
        name: result.name ?? "Persona sem nome",
        demographics: result.demographics ?? {},
        psychographics: result.psychographics ?? {},
        channels: result.channels ?? [],
        awarenessLevel: result.awarenessLevel,
        languageNotes: result.languageNotes ?? {},
        confidence: (result.confidence as "high" | "medium" | "low") ?? "medium",
        pains: {
          create: (result.pains ?? []).map((p: { description: string; intensity?: number }) => ({
            organizationId: org, description: p.description, intensity: p.intensity ?? 3,
          })),
        },
        objections: {
          create: (result.objections ?? []).map((o: { description: string; counter?: string }) => ({
            organizationId: org, description: o.description, counterArgument: o.counter,
          })),
        },
        desires: {
          create: (result.desires ?? []).map((d: { description: string; strength?: number }) => ({
            organizationId: org, description: d.description, strength: d.strength ?? 3,
          })),
        },
      },
      include: { pains: true, objections: true, desires: true },
    });
    void sub;
    return ok(persona, 201);
  });
}
