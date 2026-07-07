import { z } from "zod";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { resolveDefaultProjectId } from "@/server/client-scope";
import { buildContentSnapshot, type StrategyForSnapshot } from "@/server/editorial-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Um conteúdo antigo. Só o título é obrigatório; o resto enriquece a memória
 * da IA (gancho/CTA/formato viram padrões) mas é opcional. */
const contentInput = z.object({
  title: z.string().min(1).max(300),
  format: z.string().max(40).optional(),
  hook: z.string().max(500).optional(),
  cta: z.string().max(500).optional(),
  copy: z.string().max(20000).optional(),
});

const manualInput = z.object({
  clientId: z.string().uuid(),
  name: z.string().max(200).optional(),
  competencia: z.string().max(40).optional(),
  approvedAt: z.string().datetime().optional(),
  sentAt: z.string().datetime().optional(),
  deliveryMethod: z.enum(["message", "document"]).default("document"),
  positioning: z.string().max(2000).optional(),
  contents: z.array(contentInput).min(1).max(200),
});

/**
 * POST /api/v1/editorial-stock/manual
 *
 * Anexa manualmente uma Linha Editorial ANTIGA (feita antes/fora do SOIE) ao
 * Estoque Editorial do cliente. Serve para dar à IA a memória histórica real
 * desde o começo, em vez de só a partir das linhas geradas no SOIE.
 *
 * Cria uma EditorialStrategy já em estoque (inStock, status=approved), com os
 * conteúdos como temas — assim a visualização e a extração de padrões da IA
 * funcionam igual às linhas nativas. O snapshot é congelado no ato.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    const input = manualInput.parse(await req.json());

    const client = await prisma.client.findFirst({
      where: { id: input.clientId, organizationId: org, deletedAt: null },
      select: { id: true },
    });
    if (!client) throw Errors.notFound("Cliente");

    const projectId = await resolveDefaultProjectId(input.clientId, org);

    // Próxima versão do cliente (a importada participa da linha do tempo).
    const latest = await prisma.editorialStrategy.findFirst({
      where: { organizationId: org, clientId: input.clientId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;

    const now = new Date();
    const sentAt = input.sentAt ? new Date(input.sentAt) : now;
    const approvedAt = input.approvedAt ? new Date(input.approvedAt) : sentAt;

    // Um único agrupamento (linha → categoria → temas) a partir dos conteúdos.
    const themes = input.contents.map((c, i) => ({
      organizationId: org,
      title: c.title,
      channel: "",
      format: c.format ?? "",
      strategicObjective: "",
      hook: c.hook ?? "",
      cta: c.cta ?? "",
      productionNotes: "",
      // Copy em texto puro — a IA lê como padrão de abertura/tamanho; o
      // renderizador do estoque já mostra copy string.
      copy: (c.copy ?? "") as unknown as object,
      priority: i,
    }));

    // Monta o snapshot congelado a partir do payload (mesma forma das nativas).
    const snapshotSource: StrategyForSnapshot = {
      version,
      positioning: input.positioning ?? null,
      pillars: [],
      objectives: {},
      rationale: "Linha importada manualmente ao Estoque Editorial (histórico anterior ao SOIE).",
      editorialLines: [
        {
          name: input.name ?? "Linha importada",
          categories: [{ name: "Conteúdos", themes: input.contents }],
        },
      ],
    };
    const snapshot = buildContentSnapshot(snapshotSource, now);

    const created = await prisma.editorialStrategy.create({
      data: {
        organizationId: org,
        projectId,
        clientId: input.clientId,
        version,
        positioning: input.positioning ?? null,
        rationale: snapshotSource.rationale,
        status: "approved",
        approvedAt,
        submittedAt: approvedAt,
        // Histórico: não entra na esteira de produção (é acervo, não execução).
        productionStage: null,
        responsibleUserId: sub,
        inStock: true,
        competencia: input.competencia?.trim() || null,
        deliveryMethod: input.deliveryMethod,
        sentAt,
        contentSnapshot: snapshot as object,
        contentCount: input.contents.length,
        editorialLines: {
          create: [
            {
              organizationId: org,
              name: input.name ?? "Linha importada",
              objective: "position" as never,
              funnelStage: "tofu" as never,
              platforms: [],
              categories: {
                create: [{ organizationId: org, name: "Conteúdos", themes: { create: themes } }],
              },
            },
          ],
        },
      },
      select: { id: true, version: true, competencia: true, contentCount: true, sentAt: true },
    });

    return ok({ stock: created }, 201);
  });
}
