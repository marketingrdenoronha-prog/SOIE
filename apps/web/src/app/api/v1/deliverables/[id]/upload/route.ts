import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/v1/deliverables/:id/upload  (multipart, campo "file")
 *
 * Faz UPLOAD de UM arquivo para o Neon (guardado como bytes na tabela
 * asset_blobs) e devolve `{ url, name, kind }` apontando para a rota de
 * download. O cliente sobe cada arquivo aqui e depois agrupa tudo numa versão
 * via POST /deliverables/:id/assets (files[]). Não depende de storage externo.
 *
 * Limite: ~4 MB por arquivo — teto do corpo de uma função serverless na Vercel.
 */

// 4 MB — abaixo do teto de ~4,5 MB do corpo de request no serverless da Vercel.
const MAX_BYTES = 4 * 1024 * 1024;

const IMAGE_TYPES = ["image/png", "image/jpeg"];
const VIDEO_TYPES = ["video/quicktime", "video/mp4"];

function allowedTypesFor(deliverableType: string): string[] {
  if (deliverableType === "video_script" || deliverableType === "motion_script") return VIDEO_TYPES;
  return IMAGE_TYPES; // carousel, design_brief (estático), copy, ad, article, email_sequence
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;

    const piece = await prisma.deliverable.findFirst({
      where: { id, organizationId: org },
      select: { id: true, type: true },
    });
    if (!piece) throw Errors.notFound("Peça");

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw Errors.badRequest("Envie um arquivo no campo 'file'.");
    if (file.size === 0) throw Errors.badRequest("Arquivo vazio.");
    if (file.size > MAX_BYTES) {
      throw Errors.badRequest(
        `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB — guardamos os arquivos no banco (Neon).`,
      );
    }

    const mime = file.type || "application/octet-stream";
    const allowed = allowedTypesFor(piece.type);
    if (!allowed.includes(mime)) {
      const human = allowed.map((t) => t.split("/")[1]?.toUpperCase()).join(" ou ");
      throw Errors.badRequest(`Formato não aceito para esta peça. Envie: ${human}.`);
    }

    const kind: "image" | "video" = mime.startsWith("video/") ? "video" : "image";
    const bytes = Buffer.from(await file.arrayBuffer());

    const blob = await prisma.assetBlob.create({
      data: { organizationId: org, mimeType: mime, sizeBytes: bytes.length, data: bytes },
      select: { id: true },
    });

    return ok({ url: `/api/v1/assets/${blob.id}/raw`, name: file.name || "arquivo", kind }, 201);
  });
}
