import { z } from "zod";
import { prisma } from "@soie/db";
import { isOnboardingComplete } from "@soie/contracts";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { resolveDefaultProjectId } from "@/server/client-scope";
import { runAgent } from "@/server/ai-runtime";
import { assembleProjectContext } from "@/server/project-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const uuid = z.string().uuid();

/**
 * POST /api/v1/clients/:id/onboarding/finalize
 *
 * 1. Marca o onboarding como completed.
 * 2. Aplica campos derivados do payload direto na Brand default do cliente
 *    (positioning, valueProposition, products, objectives, icp) para que o
 *    contexto do agente `planning` já saia rico na primeira linha editorial.
 * 3. Dispara a "pesquisa automática" em paralelo (market + competition + persona
 *    + language) e persiste os artefatos como na V1.
 * 4. Consolida tudo num StrategicDossier snapshot com status="ready".
 * 5. Devolve o dossier gerado.
 *
 * Falha isolada por agente: se um estourar, o dossier fica com o resto e marca
 * as fontes ausentes em `sources`.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    const { id } = await params;
    if (!uuid.safeParse(id).success) throw Errors.notFound("Cliente");

    const client = await prisma.client.findFirst({
      where: { id, organizationId: org, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!client) throw Errors.notFound("Cliente");

    const onboarding = await prisma.strategicOnboarding.findUnique({ where: { clientId: id } });
    if (!onboarding) throw Errors.badRequest("Onboarding ainda não iniciado");
    if (!isOnboardingComplete(onboarding.payload)) {
      throw Errors.badRequest("Preencha os campos obrigatórios do onboarding antes de finalizar");
    }
    const payload = onboarding.payload as Record<string, any>;

    // Aplica campos derivados na Brand default (o agente planning lê isso).
    const projectId = await resolveDefaultProjectId(client.id, org);
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: org },
      include: { brand: true },
    });
    if (!project) throw Errors.notFound("Projeto default");

    const brandUpdates: Record<string, unknown> = {};
    if (payload.identity?.displayName) brandUpdates.name = payload.identity.displayName;
    if (payload.identity?.tagline) brandUpdates.positioning = payload.identity.tagline;
    if (payload.voice?.tone) {
      // Nada a atualizar direto na Brand; o BrandVoice será populado pelo agente.
    }
    if (payload.offer?.products?.length || payload.offer?.services?.length) {
      const productsFlat = [
        ...((payload.offer.products ?? []) as any[]).map((p) => (typeof p === "string" ? p : p?.name)),
        ...((payload.offer.services ?? []) as any[]).map((s) => (typeof s === "string" ? s : s?.name)),
      ].filter(Boolean);
      brandUpdates.products = productsFlat;
    }
    if (payload.goals?.primaryObjective) {
      brandUpdates.objectives = {
        primary: payload.goals.primaryObjective,
        secondary: payload.goals.secondaryObjectives ?? [],
        horizon: payload.goals.horizon,
        metrics: payload.goals.successMetrics,
      };
    }
    if (payload.icp?.description) {
      brandUpdates.icp = {
        descricao: payload.icp.description,
        demographics: payload.icp.demographics,
        pains: payload.icp.painPoints,
        desires: payload.icp.desires,
        channels: payload.icp.channelsWhereTheyAre,
      };
    }
    if (payload.voice?.doList || payload.voice?.dontList) {
      brandUpdates.valueProposition = (payload.competition?.differentiators ?? []).join(" · ");
    }
    if (Object.keys(brandUpdates).length > 0) {
      await prisma.brand.update({ where: { id: project.brand.id }, data: brandUpdates });
    }

    // Cria o dossier em status "generating" (a UI já pode mostrar spinner).
    // Guard de double-submit: dois cliques em "Finalizar" não podem disparar
    // duas pesquisas concorrentes (8 chamadas de IA e dois dossiês).
    const latestDossier = await prisma.strategicDossier.findFirst({
      where: { organizationId: org, clientId: client.id },
      orderBy: { version: "desc" },
      select: { version: true, status: true, createdAt: true },
    });
    if (
      latestDossier?.status === "generating" &&
      Date.now() - latestDossier.createdAt.getTime() < 3 * 60 * 1000
    ) {
      throw Errors.badRequest("Um dossiê já está sendo gerado para este cliente. Aguarde alguns instantes.");
    }
    const dossier = await prisma.strategicDossier.create({
      data: {
        organizationId: org,
        clientId: client.id,
        version: (latestDossier?.version ?? 0) + 1,
        status: "generating",
      },
    });

    // Marca o onboarding como completo antes de disparar IA — mesmo se a
    // pesquisa falhar, o operador tem o payload salvo e pode retentar.
    await prisma.strategicOnboarding.update({
      where: { id: onboarding.id },
      data: { status: "completed", completedAt: new Date() },
    });

    // ── Pesquisa automática (4 agentes em paralelo). Cada um isolado.
    // Cada agente recebe, além do contexto geral, a seção do onboarding que é
    // matéria-prima direta dele: o que o cliente declarou vale mais do que o
    // que o modelo inferiria do zero.
    const context = await assembleProjectContext(org, project.id);
    const brief = payload.goals?.primaryObjective ?? undefined;
    const agentInput = {
      brand: project.brand.name,
      positioning: project.brand.positioning,
      goal: project.goal,
      brief,
    };

    const results = await Promise.allSettled([
      runAgent(
        "market",
        { ...agentInput, offer: payload.offer, goals: payload.goals, identity: payload.identity },
        context,
      ),
      runAgent(
        "competition",
        {
          ...agentInput,
          knownCompetitors: payload.competition?.competitors,
          differentiators: payload.competition?.differentiators,
        },
        context,
      ),
      runAgent(
        "persona",
        { ...agentInput, icp: payload.icp, offer: payload.offer },
        context,
      ),
      runAgent(
        "language",
        {
          ...agentInput,
          samples: payload.voice?.referenceExamples,
          tonePreferences: payload.voice?.tone,
          formalityLevel: payload.voice?.formalityLevel,
          doList: payload.voice?.doList,
          dontList: payload.voice?.dontList,
          referenceProfiles: payload.voice?.referenceProfiles,
        },
        context,
      ),
    ]);

    const [marketRes, competitionRes, personaRes, languageRes] = results;
    const errors: string[] = [];
    const sources: Array<{ kind: string; id?: string; error?: string }> = [];

    // Cria Research umbrella para market+competition (padrão V1).
    let research: { id: string } | undefined;
    try {
      research = await prisma.research.create({
        data: {
          organizationId: org, projectId: project.id, type: "full",
          status: "succeeded", createdBy: sub, params: { source: "onboarding-finalize", brief },
        },
      });
    } catch (e) { errors.push(`research: ${e instanceof Error ? e.message : String(e)}`); }

    // Persistência dos 4 artefatos em paralelo — são independentes entre si e
    // cada bloco isola a própria falha em `sources` (nenhum derruba os demais).
    const persistMarket = async () => {
      if (marketRes.status === "rejected") {
        sources.push({ kind: "marketAnalysis", error: String(marketRes.reason) });
        return;
      }
      if (!research) return;
      const m = marketRes.value;
      try {
        const created = await prisma.marketAnalysis.create({
          data: {
            organizationId: org, projectId: project.id, researchId: research.id,
            swot: m.swot ?? {}, trends: m.trends ?? [],
            opportunities: m.opportunities ?? [], threats: m.threats ?? [],
            confidence: (m.confidence as "high" | "medium" | "low") ?? "medium",
          },
        });
        sources.push({ kind: "marketAnalysis", id: created.id });
      } catch (e) { sources.push({ kind: "marketAnalysis", error: String(e) }); }
    };

    const persistCompetition = async () => {
      if (competitionRes.status === "rejected") {
        sources.push({ kind: "competitors", error: String(competitionRes.reason) });
        return;
      }
      if (!research) return;
      const c = competitionRes.value;
      const rows = (c.competitors ?? []).map((x: any) => ({
        organizationId: org, projectId: project.id, researchId: research!.id,
        name: x.name, url: x.url, positioning: x.positioning,
        strengths: x.strengths ?? [], weaknesses: x.weaknesses ?? [],
      }));
      if (rows.length === 0) return;
      try { await prisma.competitor.createMany({ data: rows }); sources.push({ kind: "competitors", id: String(rows.length) }); }
      catch (e) { sources.push({ kind: "competitors", error: String(e) }); }
    };

    const persistPersona = async () => {
      if (personaRes.status === "rejected") {
        sources.push({ kind: "persona", error: String(personaRes.reason) });
        return;
      }
      const p = personaRes.value;
      try {
        const created = await prisma.persona.create({
          data: {
            organizationId: org, projectId: project.id,
            name: p.name ?? `Cliente ideal de ${project.brand.name}`,
            demographics: p.demographics ?? {},
            psychographics: p.psychographics ?? {},
            channels: p.channels ?? [],
            awarenessLevel: p.awarenessLevel,
            languageNotes: p.languageNotes ?? {},
            confidence: (p.confidence as "high" | "medium" | "low") ?? "medium",
            pains: { create: (p.pains ?? []).map((x: any) => ({ organizationId: org, description: x.description, intensity: x.intensity ?? 3 })) },
            objections: { create: (p.objections ?? []).map((x: any) => ({ organizationId: org, description: x.description, counterArgument: x.counter })) },
            desires: { create: (p.desires ?? []).map((x: any) => ({ organizationId: org, description: x.description, strength: x.strength ?? 3 })) },
          },
        });
        sources.push({ kind: "persona", id: created.id });
      } catch (e) { sources.push({ kind: "persona", error: String(e) }); }
    };

    const persistVoice = async () => {
      if (languageRes.status === "rejected") {
        sources.push({ kind: "brandVoice", error: String(languageRes.reason) });
        return;
      }
      const l = languageRes.value;
      try {
        const created = await prisma.brandVoice.create({
          data: {
            organizationId: org, brandId: project.brand.id,
            tone: l.tone ?? {}, formality: l.formality,
            emojisPolicy: l.emojisPolicy ?? {},
            doList: l.do ?? [], dontList: l.dont ?? [], examples: l.examples ?? [],
            confidence: (l.confidence as "high" | "medium" | "low") ?? "medium",
          },
        });
        sources.push({ kind: "brandVoice", id: created.id });
        const extras: Promise<unknown>[] = [];
        if (l.archetypes?.length) {
          extras.push(prisma.archetype.createMany({
            data: (l.archetypes as any[]).map((a) => ({
              organizationId: org, brandId: project.brand.id,
              archetype: a.archetype, weight: a.weight ?? 0.5, rationale: a.rationale,
            })),
          }));
        }
        if (l.vocabulary?.length) {
          extras.push(prisma.vocabulary.createMany({
            data: (l.vocabulary as any[]).map((v) => ({
              organizationId: org, brandId: project.brand.id,
              kind: v.kind, term: v.term, note: v.note,
            })),
          }));
        }
        await Promise.all(extras);
      } catch (e) { sources.push({ kind: "brandVoice", error: String(e) }); }
    };

    await Promise.all([persistMarket(), persistCompetition(), persistPersona(), persistVoice()]);

    // Consolida o snapshot no dossier — a UI lê `summary` para exibir.
    const summary = {
      brand: project.brand.name,
      goals: payload.goals ?? null,
      icp: payload.icp ?? null,
      market: marketRes.status === "fulfilled" ? marketRes.value : null,
      competition: competitionRes.status === "fulfilled" ? competitionRes.value : null,
      persona: personaRes.status === "fulfilled" ? personaRes.value : null,
      voice: languageRes.status === "fulfilled" ? languageRes.value : null,
      recommendations: buildRecommendations(payload, {
        market: marketRes.status === "fulfilled" ? marketRes.value : null,
        persona: personaRes.status === "fulfilled" ? personaRes.value : null,
      }),
    };

    const finished = await prisma.strategicDossier.update({
      where: { id: dossier.id },
      data: {
        status: errors.length > 0 && !summary.market ? "failed" : "ready",
        summary: summary as object,
        sources: sources as object,
        generatedAt: new Date(),
      },
    });

    return ok({ dossier: finished, errors });
  });
}

/** Sugestões de próximos passos derivadas do payload + pesquisa. */
function buildRecommendations(
  payload: Record<string, any>,
  research: { market: any; persona: any },
): string[] {
  const out: string[] = [];
  if (research.market?.opportunities?.length) {
    out.push(`Aproveitar oportunidade de mercado: ${research.market.opportunities[0]}.`);
  }
  if (research.persona?.pains?.length) {
    out.push(`Falar diretamente à dor principal: "${research.persona.pains[0]?.description ?? ""}".`);
  }
  if (payload.competition?.differentiators?.length) {
    out.push(`Reforçar diferencial: ${payload.competition.differentiators[0]}.`);
  }
  if (payload.goals?.primaryObjective) {
    out.push(`Ancorar comunicação no objetivo: ${payload.goals.primaryObjective}.`);
  }
  return out.slice(0, 5);
}
