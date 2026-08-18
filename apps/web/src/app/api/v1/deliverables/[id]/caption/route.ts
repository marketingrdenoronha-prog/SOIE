import { z } from "zod";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { generatePostCaption } from "@/server/ai-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const input = z.object({ channel: z.string().max(60).optional() });

/**
 * POST /deliverables/:id/caption — gera uma legenda por IA a partir do conteúdo
 * aprovado da peça (copy/tema/gancho/CTA) e do canal. Não persiste — o operador
 * revisa e salva no agendamento.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    const body = input.parse(await req.json().catch(() => ({})));

    const d = await prisma.deliverable.findFirst({
      where: { id, organizationId: org },
      select: { id: true, title: true, channel: true, brief: true, spec: true, originTheme: { select: { hook: true, cta: true, copy: true } } },
    });
    if (!d) throw Errors.notFound("Peça");

    const out = await generatePostCaption(
      {
        channel: body.channel || d.channel,
        title: d.title,
        brief: d.brief ?? undefined,
        copy: d.originTheme?.copy ?? d.spec,
        hook: d.originTheme?.hook ?? null,
        cta: d.originTheme?.cta ?? null,
      },
      { organizationId: org },
    );

    return ok(out);
  });
}
