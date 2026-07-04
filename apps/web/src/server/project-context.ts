import { prisma } from "@soie/db";

/**
 * Assembles the strategic context of a project (business, audience, brand voice
 * and editorial line) into the shape the AI agents consume.
 *
 * This is what makes a deliverable "contexto antes de conteúdo" (Constitution
 * P1): a roteiro generated for an existing project is written on top of its
 * persona, brand DNA and editorial strategy — not from the brief alone.
 */
export async function assembleProjectContext(
  organizationId: string,
  projectId: string,
): Promise<Record<string, unknown>> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
    include: {
      brand: {
        include: {
          brandVoices: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      personas: {
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { pains: true, desires: true, objections: true },
      },
      editorialStrategies: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          editorialLines: {
            include: { categories: { include: { themes: true } } },
          },
        },
      },
    },
  });
  if (!project) return {};

  const brand = project.brand;
  const voice = brand.brandVoices[0];
  const strategy = project.editorialStrategies[0];

  const context: Record<string, unknown> = {
    business: {
      project: project.name,
      goal: project.goal,
      brand: brand.name,
      positioning: brand.positioning,
      valueProposition: brand.valueProposition,
      objectives: brand.objectives,
      products: brand.products,
    },
  };

  if (project.personas.length > 0) {
    context.audienceSignals = project.personas.map((p) => ({
      name: p.name,
      demographics: p.demographics,
      psychographics: p.psychographics,
      awarenessLevel: p.awarenessLevel,
      channels: p.channels,
      pains: p.pains.map((x) => x.description),
      desires: p.desires.map((x) => x.description),
      objections: p.objections.map((x) => x.description),
    }));
  }

  if (voice) {
    context.brandVoice = {
      tone: voice.tone,
      formality: voice.formality,
      do: voice.doList,
      dont: voice.dontList,
      examples: voice.examples,
    };
  }

  if (strategy) {
    context.editorialLine = {
      positioning: strategy.positioning,
      pillars: strategy.pillars,
      lines: strategy.editorialLines.map((l) => ({
        name: l.name,
        objective: l.objective,
        funnelStage: l.funnelStage,
        categories: l.categories.map((c) => ({
          name: c.name,
          themes: c.themes.map((t) => t.title),
        })),
      })),
    };
  }

  return context;
}
