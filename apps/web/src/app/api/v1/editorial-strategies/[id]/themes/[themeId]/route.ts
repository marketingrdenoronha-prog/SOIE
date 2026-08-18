import { prisma } from "@soie/db";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchInput = z.object({
  // Controle de revisão por conteúdo (STATUS DO CONTEÚDO).
  contentStatus: z.enum(["aprovado", "revisar", "reescrever", "excluir"]).nullable().optional(),
  // Campo AJUSTES MANUAIS — instruções específicas só para este conteúdo.
  adjustmentNote: z.string().max(4000).nullable().optional(),
});

/** Garante que o tema pertence à estratégia e à organização do usuário. */
async function ownedTheme(org: string, strategyId: string, themeId: string) {
  const theme = await prisma.theme.findFirst({
    where: { id: themeId, organizationId: org, category: { editorialLine: { strategyId } } },
    select: { id: true },
  });
  if (!theme) throw Errors.notFound("Conteúdo");
  return theme;
}

/**
 * PATCH /editorial-strategies/:id/themes/:themeId
 * Salva os AJUSTES MANUAIS e/ou o STATUS de UM conteúdo — sem IA e sem tocar
 * em nenhum outro conteúdo da linha.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; themeId: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id, themeId } = await params;
    await ownedTheme(org, id, themeId);
    const body = patchInput.parse(await req.json());

    const data: Record<string, unknown> = {};
    if (body.contentStatus !== undefined) data.contentStatus = body.contentStatus;
    if (body.adjustmentNote !== undefined) data.adjustmentNote = body.adjustmentNote?.trim() || null;
    if (Object.keys(data).length === 0) throw Errors.badRequest("Nada para salvar.");

    const updated = await prisma.theme.update({
      where: { id: themeId },
      data,
      select: { id: true, contentStatus: true, adjustmentNote: true },
    });
    return ok(updated);
  });
}

/**
 * DELETE /editorial-strategies/:id/themes/:themeId
 * Remove UM conteúdo da linha (ação do status "Excluir"). Nenhum outro é
 * afetado. Bloqueado depois de aprovada — a linha aprovada é imutável.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; themeId: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id, themeId } = await params;
    await ownedTheme(org, id, themeId);

    const strategy = await prisma.editorialStrategy.findFirst({
      where: { id, organizationId: org },
      select: { status: true },
    });
    if (strategy?.status === "approved") throw Errors.badRequest("Linha já aprovada — não é possível excluir conteúdos.");

    await prisma.theme.delete({ where: { id: themeId } });
    return ok({ id: themeId, deleted: true });
  });
}
