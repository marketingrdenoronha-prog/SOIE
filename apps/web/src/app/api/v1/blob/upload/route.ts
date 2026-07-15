import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import jwt from "jsonwebtoken";
import { prisma } from "@soie/db";
import { env } from "@soie/config";
import { jwtClaims } from "@soie/contracts";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Localiza o token de leitura/escrita do Vercel Blob de forma tolerante.
 *
 * O SDK só procura `BLOB_READ_WRITE_TOKEN`, mas quando o store é criado com um
 * PREFIXO custom de variáveis (ex.: o prefixo virou "BLOB_READ_WRITE_TOKEN"),
 * a Vercel gera nomes como `<PREFIXO>_READ_WRITE_TOKEN`, `<PREFIXO>_STORE_ID`,
 * etc. — e o nome exato `BLOB_READ_WRITE_TOKEN` não existe. Aqui resolvemos:
 *   1. nome padrão;
 *   2. qualquer env cujo NOME termina em READ_WRITE_TOKEN (o valor é o token);
 *   3. qualquer env cujo VALOR pareça um token de Blob (vercel_blob_rw_...).
 */
function resolveBlobToken(): { token?: string; source?: string } {
  if (process.env.BLOB_READ_WRITE_TOKEN) return { token: process.env.BLOB_READ_WRITE_TOKEN, source: "BLOB_READ_WRITE_TOKEN" };
  if (env.BLOB_READ_WRITE_TOKEN) return { token: env.BLOB_READ_WRITE_TOKEN, source: "BLOB_READ_WRITE_TOKEN (config)" };

  const entries = Object.entries(process.env).filter(
    (e): e is [string, string] => typeof e[1] === "string" && e[1].length > 0,
  );
  // Nome termina em READ_WRITE_TOKEN (cobre <PREFIXO>_READ_WRITE_TOKEN).
  const byName = entries.filter(([k]) => /READ_WRITE_TOKEN$/.test(k));
  const rw = byName.find(([, v]) => v.startsWith("vercel_blob_rw_")) ?? byName[0];
  if (rw) return { token: rw[1], source: rw[0] };
  // Último recurso: valor que parece um token de Blob.
  const byValue = entries.find(([, v]) => v.startsWith("vercel_blob_rw_"));
  if (byValue) return { token: byValue[1], source: byValue[0] };
  return {};
}

function blobToken(): string | undefined {
  return resolveBlobToken().token;
}

/** GET /api/v1/blob/upload — diagnóstico: diz se o Vercel Blob está configurado
 * neste deployment (sem vazar o valor do token). Útil para saber, na hora do
 * erro, se falta o BLOB_READ_WRITE_TOKEN no ambiente que você está testando. */
export async function GET(req: Request) {
  return handle(async () => {
    requireAuth(req);
    const { token, source } = resolveBlobToken();
    return ok({ configured: Boolean(token), source: source ?? null });
  });
}

/**
 * POST /api/v1/blob/upload
 *
 * Rota de autorização do upload direto para o Vercel Blob. O navegador chama
 * `upload()` (@vercel/blob/client), que bate aqui para pegar um token de
 * cliente de curta duração e então envia o arquivo DIRETO para o Blob — sem
 * passar pelo corpo do serverless (que é limitado a ~4,5 MB). Assim suportamos
 * arquivos grandes (vídeos) via multipart.
 *
 * Autenticação: o `upload()` do cliente envia o Bearer token no header (opção
 * `headers`), lido aqui dentro do onBeforeGenerateToken. Os tipos de arquivo
 * aceitos são travados por formato da peça (PNG para arte/carrossel, MOV/MP4
 * para vídeo).
 */

const IMAGE_TYPES = ["image/png", "image/jpeg"];
const VIDEO_TYPES = ["video/quicktime", "video/mp4"];

/** Tipos MIME aceitos conforme o formato da peça. */
function allowedTypesFor(deliverableType: string): string[] {
  if (deliverableType === "video_script" || deliverableType === "motion_script") return VIDEO_TYPES;
  // carousel, design_brief (estático), copy, ad, article, email_sequence → arte PNG
  return IMAGE_TYPES;
}

// 5 TB — teto do multipart do Blob; na prática "sem limite" para nossos vídeos.
const MAX_BYTES = 5 * 1024 * 1024 * 1024 * 1024;

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as HandleUploadBody;
  const token = blobToken();

  try {
    const json = await handleUpload({
      body,
      request: req,
      token,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!token) {
          throw new Error(
            "Armazenamento de arquivos não configurado. Ative o Vercel Blob e defina BLOB_READ_WRITE_TOKEN.",
          );
        }
        // Auth via Bearer token no header (enviado pelo upload() do cliente).
        const header = req.headers.get("authorization");
        const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
        if (!bearer) throw new Error("Não autenticado.");
        let claims;
        try {
          claims = jwtClaims.parse(jwt.verify(bearer, env.JWT_ACCESS_SECRET));
        } catch {
          throw new Error("Sessão inválida ou expirada.");
        }

        let parsed: { deliverableId?: string };
        try {
          parsed = JSON.parse(clientPayload ?? "{}");
        } catch {
          throw new Error("Payload inválido.");
        }
        if (!parsed.deliverableId) throw new Error("Peça não informada.");

        const piece = await prisma.deliverable.findFirst({
          where: { id: parsed.deliverableId, organizationId: claims.org },
          select: { id: true, type: true },
        });
        if (!piece) throw new Error("Peça não encontrada.");

        return {
          allowedContentTypes: allowedTypesFor(piece.type),
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ deliverableId: piece.id, org: claims.org, sub: claims.sub }),
        };
      },
      // A persistência do DeliverableAsset é feita no cliente logo após o
      // upload resolver (POST /deliverables/:id/assets), então este callback
      // (que não dispara em localhost) é apenas um no-op.
      onUploadCompleted: async () => {},
    });

    return Response.json(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro no upload.";
    return Response.json({ error: { message } }, { status: 400 });
  }
}
