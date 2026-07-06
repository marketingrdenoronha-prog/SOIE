import { prisma } from "@soie/db";

/**
 * Assembles the strategic context of a project (business, audience, brand voice
 * and editorial line) into the shape the AI agents consume.
 *
 * This is what makes a deliverable "contexto antes de conteúdo" (Constitution
 * P1): a roteiro generated for an existing project is written on top of its
 * persona, brand DNA and editorial strategy — not from the brief alone.
 *
 * Performance: this runs inside serverless request handlers against a remote
 * Postgres (Neon), so after the initial project fetch every other query is
 * issued in a single Promise.all — one round-trip wave instead of five.
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

  // Each query gets its own const so Prisma's generic result inference has a
  // clean site (inlining all seven inside Promise.all made TS widen some
  // results to the bare model, dropping the selected relations). PrismaPromises
  // only execute when awaited, so Promise.all below still runs them as one
  // parallel wave.
  // Durable memory the user curates (guidelines, brand language, editorial
  // direction). Pulled across the whole scope hierarchy that applies to this
  // project so it's always part of every generation.
  const memoriesQ = prisma.memory.findMany({
    where: {
      organizationId,
      OR: [
        { scope: "org", scopeId: organizationId },
        { scope: "client", scopeId: brand.clientId },
        { scope: "brand", scopeId: brand.id },
        { scope: "project", scopeId: project.id },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Market + competition already gathered for this project (so downstream
  // agents reason on top of the research instead of re-deriving it).
  const marketAnalysisQ = prisma.marketAnalysis.findFirst({
    where: { organizationId, projectId },
    orderBy: { createdAt: "desc" },
  });
  const competitorsQ = prisma.competitor.findMany({
    where: { organizationId, projectId },
    orderBy: { name: "asc" },
    take: 10,
  });

  // Editorial-line HISTORY: previous strategies for this client so a new line
  // evolves from what came before. `select` keeps the payload lean — the full
  // per-theme `copy` Json would bloat both the DB transfer and the prompt.
  const pastStrategiesQ = prisma.editorialStrategy.findMany({
    where: {
      organizationId,
      OR: [{ clientId: brand.clientId }, { project: { brand: { clientId: brand.clientId } } }],
      ...(strategy ? { id: { not: strategy.id } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      version: true,
      status: true,
      createdAt: true,
      positioning: true,
      pillars: true,
      editorialLines: {
        select: {
          name: true,
          categories: {
            select: {
              name: true,
              themes: { select: { title: true, hook: true } },
            },
          },
        },
      },
      reviewComments: {
        where: { decision: "request_changes" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { comment: true },
      },
    },
  });

  // Repertoire: what was already produced for this CLIENT (across all their
  // projects) + the feedback it got.
  const priorDeliverablesQ = prisma.deliverable.findMany({
    where: {
      organizationId,
      project: { brand: { clientId: brand.clientId } },
      status: { in: ["client_review", "approved", "changes_requested", "delivered"] },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      title: true,
      type: true,
      channel: true,
      brief: true,
      spec: true,
      comments: {
        where: { decision: "request_changes" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { comment: true },
      },
    },
  });

  // The client's own words: the onboarding wizard answers are the richest
  // first-party signal (goals, offer, ICP, named competitors, voice rules).
  const onboardingQ = prisma.strategicOnboarding.findUnique({
    where: { clientId: brand.clientId },
    select: { status: true, payload: true },
  });

  // Frozen strategic dossier: the consolidated research snapshot + priority
  // recommendations produced right after onboarding.
  const dossierQ = prisma.strategicDossier.findFirst({
    where: { organizationId, clientId: brand.clientId, status: "ready" },
    orderBy: { createdAt: "desc" },
    select: { version: true, summary: true, generatedAt: true },
  });

  const [
    memories,
    marketAnalysis,
    competitors,
    pastStrategies,
    priorDeliverables,
    onboarding,
    dossier,
  ] = await Promise.all([
    memoriesQ,
    marketAnalysisQ,
    competitorsQ,
    pastStrategiesQ,
    priorDeliverablesQ,
    onboardingQ,
    dossierQ,
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

  // The client's raw onboarding answers. This is first-party truth: what the
  // client says about their own goals, offer, ICP, competitors and voice beats
  // anything the research agents infer.
  if (onboarding && onboarding.payload && typeof onboarding.payload === "object") {
    const p = onboarding.payload as Record<string, unknown>;
    const clientProfile: Record<string, unknown> = {};
    for (const key of ["identity", "goals", "offer", "icp", "competition", "voice", "materials"]) {
      if (p[key] !== undefined && p[key] !== null) clientProfile[key] = p[key];
    }
    if (Object.keys(clientProfile).length > 0) {
      context.clientProfile = {
        note:
          "Respostas do PRÓPRIO CLIENTE no onboarding. É a fonte primária da verdade sobre objetivos, oferta, ICP, concorrentes e voz — quando conflitar com inferências de pesquisa, o que o cliente declarou prevalece.",
        ...clientProfile,
      };
    }
  }

  // The frozen dossier consolidates the automatic research into one snapshot;
  // its priority recommendations anchor every editorial decision downstream.
  if (dossier && dossier.summary && typeof dossier.summary === "object") {
    const s = dossier.summary as Record<string, any>;
    context.dossier = {
      note:
        "Dossiê estratégico congelado (pesquisa automática consolidada). Use as recomendações como direção prioritária da comunicação.",
      version: dossier.version,
      generatedAt: dossier.generatedAt,
      recommendations: Array.isArray(s.recommendations) ? s.recommendations : [],
      marketSummary: typeof s.market?.summary === "string" ? s.market.summary : undefined,
      competitionSummary: typeof s.competition?.summary === "string" ? s.competition.summary : undefined,
    };
  }

  // The framework ("como penso pra fazer") is the copy foundation: split it out
  // so it can be elevated in the prompt, above the rest of the memory.
  const frameworkEntries = memories.filter((m) => m.kind === "framework");
  const otherMemories = memories.filter((m) => m.kind !== "framework");

  if (frameworkEntries.length > 0) {
    context.framework = {
      note:
        "Framework do usuário — o método/raciocínio que guia TODA a produção. Baseie CADA copy, roteiro e linha editorial neste framework; ele tem prioridade sobre estilos genéricos.",
      content: frameworkEntries.map((m) => m.content),
    };
  }

  if (otherMemories.length > 0) {
    context.memory = {
      note:
        "Memória curada pelo usuário. Trate como REGRAS OBRIGATÓRIAS: respeite estas diretrizes de linguagem, tom e linha editorial em tudo que gerar.",
      entries: otherMemories.map((m) => ({ kind: m.kind, content: m.content, scope: m.scope })),
    };
  }

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

  if (pastStrategies.length > 0) {
    context.editorialHistory = {
      note:
        "Linhas editoriais anteriores deste cliente. Evolua a partir delas: mantenha o que funcionou, evite repetir e refine — não recomece do zero.",
      strategies: pastStrategies.map((s) => ({
        version: s.version,
        status: s.status,
        date: s.createdAt,
        positioning: s.positioning,
        pillars: s.pillars,
        lines: s.editorialLines.map((l) => ({
          name: l.name,
          categories: l.categories.map((c) => ({ name: c.name, themes: c.themes.map((t) => t.title) })),
        })),
        feedback: s.reviewComments.map((c) => c.comment).filter(Boolean),
      })),
    };

    const approved = pastStrategies.filter((s) => s.status === "approved");
    const approvedThemes = approved.flatMap((s) =>
      s.editorialLines.flatMap((l) => l.categories.flatMap((c) => c.themes)),
    );
    const themesUsed = approvedThemes.map((t) => t.title).slice(0, 150);
    const hooksUsed = approvedThemes.map((t) => t.hook).filter(Boolean).slice(0, 150);
    const categoriesUsed = [
      ...new Set(
        approved.flatMap((s) => s.editorialLines.flatMap((l) => l.categories.map((c) => c.name))),
      ),
    ].slice(0, 60);
    if (themesUsed.length > 0 || categoriesUsed.length > 0) {
      context.contentMemory = {
        note:
          "Memória de conteúdo das linhas editoriais APROVADAS. NÃO repita estes temas nem estes ganchos; evite repetição excessiva de categorias e proponha ângulos novos e evolução estratégica.",
        themesUsed,
        hooksUsed,
        categoriesUsed,
      };
    }
  }

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
