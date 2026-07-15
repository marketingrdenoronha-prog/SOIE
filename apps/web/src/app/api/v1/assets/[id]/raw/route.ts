import { prisma } from "@soie/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/assets/:id/raw
 *
 * Serve o arquivo binário guardado no Neon (AssetBlob). PÚBLICO de propósito: o
 * portal de aprovação do cliente (sem login) precisa carregar as artes/vídeos.
 * O `id` é um UUID não-adivinhável (mesma proteção "por posse" de um link
 * assinado). Cacheável e imutável (o conteúdo de um id nunca muda).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // UUID v4 — evita varredura e queries inválidas.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const blob = await prisma.assetBlob.findUnique({ where: { id } });
  if (!blob) return new Response("Not found", { status: 404 });

  // `data` vem como Uint8Array/Buffer do Prisma.
  const body = blob.data as unknown as Uint8Array;
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": blob.mimeType || "application/octet-stream",
      "content-length": String(blob.sizeBytes),
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
