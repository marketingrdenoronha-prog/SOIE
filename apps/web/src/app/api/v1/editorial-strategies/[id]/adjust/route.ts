import { prisma } from "@soie/db";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { generateNextStrategyVersion } from "@/server/editorial-version";
import { summarizeEditorialAdjustment } from "@/server/ai-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A geração (auto/manual) faz várias chamadas de IA — precisa da janela grande.
export const maxDuration = 300;

const input = z.object({
  // summary  → IA só resume o que entendeu + o que faria (não muda nada)
  // auto     → IA reajusta sozinha (gera próxima versão dobrando o feedback)
  // manual   → operador escreve a direção do ajuste (guidance) e a IA gera
  mode: z.enum(["summary", "auto", "manual"]),
  guidance: z.string().max(4000).optional(),
});

/**
 * POST /editorial-strategies/:id/adjust
 *
 * Central de AJUSTE DA LINHA EDITORIAL (não vale para material pronto). Três
 * modos: "summary" (a IA resume o pedido do cliente e o que faria, sem alterar
 * nada), "auto" (a IA reajusta sozinha gerando a próxima versão a partir do
 * feedback) e "manual" (o operador escreve a direção e a IA gera a versão).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    const body = input.parse(await req.json().catch(() => ({})));

    const strategy = await prisma.editorialStrategy.findFirst({
      where: { id, organizationId: org },
      include: {
        reviewComments: { where: { decision: "request_changes" }, orderBy: { createdAt: "desc" }, take: 5 },
        editorialLines: { include: { categories: { include: { themes: { select: { title: true } } } } } },
      },
    });
    if (!strategy) throw Errors.notFound("Linha editorial");
    if (!strategy.clientId) throw Errors.badRequest("Linha editorial sem cliente vinculado.");

    const client = await prisma.client.findFirst({
      where: { id: strategy.clientId, organizationId: org, deletedAt: null },
      select: { id: true, name: true, industry: true },
    });
    if (!client) throw Errors.notFound("Cliente");

    const feedback = strategy.reviewComments
      .map((c) => c.comment)
      .filter((x): x is string => Boolean(x && x.trim()))
      .join("\n");
    const themeTitles = strategy.editorialLines.flatMap((l) =>
      l.categories.flatMap((c) => c.themes.map((t) => t.title)),
    );

    // Passo 1 — só resume, não altera nada.
    if (body.mode === "summary") {
      const summary = await summarizeEditorialAdjustment(
        {
          clientName: client.name,
          niche: client.industry ?? undefined,
          positioning: strategy.positioning,
          version: strategy.version,
          feedback: feedback || "(o cliente não deixou comentário escrito)",
          themes: themeTitles,
        },
        { organizationId: org },
      );
      return ok(summary);
    }

    const guidance = body.mode === "manual" ? (body.guidance?.trim() ?? "") : "";
    if (body.mode === "manual" && !guidance) throw Errors.badRequest("Descreva o que ajustar (modo manual).");
    // Automático precisa de um pedido do cliente para se basear — sem isso não
    // há o que "reajustar"; oriente o operador a usar o modo manual.
    if (body.mode === "auto" && !feedback) {
      throw Errors.badRequest("O cliente não deixou um pedido escrito. Use o modo manual para descrever o ajuste.");
    }

    // Passo 2 — gera a PRÓXIMA versão da linha (auto = dobra o feedback do
    // cliente automaticamente; manual = usa a direção do operador). Ponto único
    // de geração de versão; nunca sobrescreve (a atual vira parentStrategyId).
    const created = await generateNextStrategyVersion(org, client.id, {
      guidance: guidance || undefined,
    });
    const demo = typeof created.rationale === "string" && created.rationale.startsWith("[MODO DEMO");

    return ok({ id: created.id, version: created.version, mode: body.mode, demo }, 201);
  });
}
