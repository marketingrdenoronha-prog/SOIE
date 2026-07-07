import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/dashboard
 *
 * Visão executiva REAL do fluxo SOIE V2. Tudo agregado no Postgres a partir das
 * tabelas de produção — nada de números fixos. Estrutura o funil operacional:
 * Clientes → Onboarding/Dossiê → Linhas Editoriais (esteira) → Peças → Estoque,
 * mais aprovações pendentes e custo de IA do mês.
 */
export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const where = { organizationId: org };

    // Início do mês corrente (UTC) para o custo de IA do período.
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [
      clientsTotal,
      onboardingsDone,
      dossiersReady,
      stratByStage,
      stratByStatus,
      stratInStock,
      pieceByStatus,
      aiMonth,
      aiTotal,
      recentStrategies,
      recentExecutions,
    ] = await Promise.all([
      prisma.client.count({ where: { ...where, deletedAt: null } }),
      prisma.strategicOnboarding.count({ where: { ...where, status: "completed" } }),
      prisma.strategicDossier.count({ where: { ...where, status: "ready" } }),
      prisma.editorialStrategy.groupBy({ by: ["productionStage"], where, _count: true }),
      prisma.editorialStrategy.groupBy({ by: ["status"], where, _count: true }),
      prisma.editorialStrategy.count({ where: { ...where, inStock: true } }),
      prisma.deliverable.groupBy({ by: ["productionStatus"], where, _count: true }),
      prisma.aIExecution.aggregate({
        where: { ...where, createdAt: { gte: monthStart } },
        _sum: { costUsd: true },
        _count: true,
      }),
      prisma.aIExecution.aggregate({
        where,
        _sum: { costUsd: true, inputTokens: true, outputTokens: true },
        _count: true,
      }),
      prisma.editorialStrategy.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          version: true,
          status: true,
          productionStage: true,
          contentCount: true,
          inStock: true,
          createdAt: true,
          project: {
            select: {
              name: true,
              brand: { select: { client: { select: { name: true } } } },
            },
          },
        },
      }),
      prisma.aIExecution.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          provider: true,
          model: true,
          costUsd: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    // Converte groupBy[] → mapa {chave: count} (chaves nulas viram "none").
    const tally = (rows: { _count: number }[], key: string) =>
      rows.reduce<Record<string, number>>((acc, r) => {
        const k = (r as Record<string, unknown>)[key];
        acc[typeof k === "string" ? k : "none"] = r._count;
        return acc;
      }, {});

    const stage = tally(stratByStage, "productionStage");
    const status = tally(stratByStatus, "status");
    const piece = tally(pieceByStatus, "productionStatus");
    const sum = (obj: Record<string, number>, ...keys: string[]) =>
      keys.reduce((n, k) => n + (obj[k] ?? 0), 0);

    // Aprovações pendentes = linhas em revisão do cliente + peças aguardando o
    // cliente aprovar. É o "precisa de atenção" do operador.
    const linhasEmRevisao = stage["client_review"] ?? 0;
    const pecasComCliente = piece["aprovacao_cliente"] ?? 0;

    // ── SIMULAÇÃO DE CUSTO POR MODELO ────────────────────────────────────────
    // "E se todo o consumo de IA até agora tivesse rodado no modelo X?" — precifica
    // o total de tokens já consumidos sob cada modelo, usando o mesmo price book do
    // sistema (por 1k tokens). Só considera execuções que registraram tokens
    // (planning + pesquisa); produções sem telemetria de token não entram na
    // reprojeção mas continuam no custo real (custoTotalUsd).
    const inTokens = aiTotal._sum.inputTokens ?? 0;
    const outTokens = aiTotal._sum.outputTokens ?? 0;
    // Preço por 1k tokens (fallback = valores do seed; sobrescrito pelo price book).
    const PRICE_FALLBACK: Record<string, { in: number; out: number }> = {
      "gpt-4o": { in: 0.005, out: 0.015 },
      "claude-sonnet-5": { in: 0.003, out: 0.015 },
    };
    const priceRows = await prisma.aIPriceBook.findMany({
      where: { model: { in: ["gpt-4o", "claude-sonnet-5"] }, effectiveTo: null },
      orderBy: { effectiveFrom: "desc" },
      select: { model: true, inputPricePer1k: true, outputPricePer1k: true },
    });
    const priceOf = (model: string) => {
      const row = priceRows.find((p) => p.model === model);
      return row
        ? { in: row.inputPricePer1k, out: row.outputPricePer1k }
        : PRICE_FALLBACK[model];
    };
    const projectCost = (model: string) => {
      const p = priceOf(model);
      return (inTokens / 1000) * p.in + (outTokens / 1000) * p.out;
    };
    const cost4o = projectCost("gpt-4o");
    const costSonnet5 = projectCost("claude-sonnet-5");

    return ok({
      clients: {
        total: clientsTotal,
        onboardingConcluido: onboardingsDone,
        semOnboarding: Math.max(0, clientsTotal - onboardingsDone),
        dossiesProntos: dossiersReady,
      },
      editorial: {
        total: Object.values(status).reduce((a, b) => a + b, 0),
        emRevisaoCliente: linhasEmRevisao,
        aprovadas: stage["approved"] ?? 0,
        emProducao: stage["design"] ?? 0,
        aPostar: stage["to_post"] ?? 0,
        emAcervo: stratInStock,
        porStatus: status,
        porEstagio: stage,
      },
      pieces: {
        total: Object.values(piece).reduce((a, b) => a + b, 0),
        aguardando: piece["aguardando"] ?? 0,
        emProducao: piece["em_producao"] ?? 0,
        produzida: piece["produzida"] ?? 0,
        emRevisaoInterna: piece["aprovada_interna"] ?? 0,
        aprovacaoCliente: pecasComCliente,
        aprovadas: sum(piece, "aprovada"),
        porStatus: piece,
      },
      approvals: {
        pendentes: linhasEmRevisao + pecasComCliente,
        linhas: linhasEmRevisao,
        pecas: pecasComCliente,
      },
      ai: {
        custoMesUsd: aiMonth._sum.costUsd ?? 0,
        execucoesMes: aiMonth._count,
        custoTotalUsd: aiTotal._sum.costUsd ?? 0,
        execucoesTotal: aiTotal._count,
        // Simulação "e se todo o consumo tivesse rodado no modelo X".
        costSimulation: {
          inputTokens: inTokens,
          outputTokens: outTokens,
          totalTokens: inTokens + outTokens,
          gpt4oUsd: cost4o,
          sonnet5Usd: costSonnet5,
          economiaUsd: cost4o - costSonnet5,
          economiaPct: cost4o > 0 ? ((cost4o - costSonnet5) / cost4o) * 100 : 0,
        },
      },
      recentStrategies: recentStrategies.map((s) => ({
        id: s.id,
        version: s.version,
        status: s.status,
        productionStage: s.productionStage,
        contentCount: s.contentCount,
        inStock: s.inStock,
        createdAt: s.createdAt,
        clientName: s.project?.brand?.client?.name ?? s.project?.name ?? "—",
      })),
      recentExecutions,
    });
  });
}
