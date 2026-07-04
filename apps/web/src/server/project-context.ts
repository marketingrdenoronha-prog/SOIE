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

  // Market + competition already gathered for this project (so downstream
  // agents reason on top of the research instead of re-deriving it).
  const [marketAnalysis, competitors] = await Promise.all([
    prisma.marketAnalysis.findFirst({
      where: { organizationId, projectId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.competitor.findMany({
      where: { organizationId, projectId },
      orderBy: { name: "asc" },
      take: 10,
    }),
  ]);

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

  if (marketAnalysis || competitors.length > 0) {
    context.market = {
      swot: marketAnalysis?.swot,
      trends: marketAnalysis?.trends,
      opportunities: marketAnalysis?.opportunities,
      threats: marketAnalysis?.threats,
      competitors: competitors.map((c) => ({
        name: c.name,
        positioning: c.positioning,
        strengths: c.strengths,
        weaknesses: c.weaknesses,
      })),
    };
  }

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

  // Repertoire: what was already produced for this client + the feedback it
  // got. Feeding this back lets the model avoid repeating angles/hooks and
  // steer clear of mistakes the client already flagged.
  const priorDeliverables = await prisma.deliverable.findMany({
    where: {
      organizationId,
      projectId,
      status: { in: ["client_review", "approved", "changes_requested", "delivered"] },
    },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: {
      comments: {
        where: { decision: "request_changes" },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  if (priorDeliverables.length > 0) {
    context.repertoire = {
      note:
        "Entregas já produzidas para este cliente. NÃO repita os mesmos ângulos, ganchos ou temas; traga abordagens novas e evite os erros apontados nos feedbacks.",
      deliverables: priorDeliverables.map((d) => ({
        title: d.title,
        type: d.type,
        channel: d.channel,
        brief: d.brief,
        summary: summarizeSpec(d.spec),
        feedback: d.comments.map((c) => c.comment).filter(Boolean),
      })),
    };
  }

  return context;
}

/** Extracts a short, human-readable gist from a deliverable spec (which can be
 * any AI-produced JSON) to use as repertoire without bloating the prompt. */
function summarizeSpec(spec: unknown): string {
  if (!spec || typeof spec !== "object") return "";
  const s = spec as Record<string, any>;
  const parts: string[] = [];
  if (typeof s.theme === "string") parts.push(s.theme);
  if (typeof s.hook === "string") parts.push(s.hook);
  if (typeof s.caption === "string") parts.push(s.caption);
  if (Array.isArray(s.slides)) parts.push(s.slides.map((x: any) => x?.title).filter(Boolean).join(" | "));
  if (Array.isArray(s.variants)) parts.push(s.variants.map((x: any) => x?.headline).filter(Boolean).join(" | "));
  if (typeof s.title === "string") parts.push(s.title);
  return parts.filter(Boolean).join(" — ").slice(0, 400);
}
