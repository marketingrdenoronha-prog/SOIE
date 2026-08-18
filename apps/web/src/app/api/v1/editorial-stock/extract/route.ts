import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { stripNul } from "@/server/editorial-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * POST /api/v1/editorial-stock/extract
 *
 * Recebe um documento (PDF, Word .docx ou texto) via multipart e devolve o
 * texto extraído, para preencher o formulário de anexo manual do Estoque
 * Editorial. Não persiste nada — só extrai. A gravação continua em
 * POST /editorial-stock/manual (o operador revisa antes de salvar).
 */
export async function POST(req: Request) {
  return handle(async () => {
    requireAuth(req);

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw Errors.badRequest("Envie um arquivo no campo 'file'.");
    if (file.size === 0) throw Errors.badRequest("Arquivo vazio.");
    if (file.size > MAX_BYTES) throw Errors.badRequest("Arquivo muito grande (máx. 8 MB).");

    const name = file.name || "documento";
    const lower = name.toLowerCase();
    const type = file.type || "";
    const buf = Buffer.from(await file.arrayBuffer());

    let text = "";
    try {
      if (lower.endsWith(".pdf") || type === "application/pdf") {
        const { extractText, getDocumentProxy } = await import("unpdf");
        const pdf = await getDocumentProxy(new Uint8Array(buf));
        const res = await extractText(pdf, { mergePages: true });
        text = Array.isArray(res.text) ? res.text.join("\n") : res.text;
      } else if (
        lower.endsWith(".docx") ||
        type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const mammothMod = (await import("mammoth")) as any;
        const mammoth = mammothMod.default ?? mammothMod;
        const res = await mammoth.extractRawText({ buffer: buf });
        text = res.value ?? "";
      } else if (lower.endsWith(".doc")) {
        throw Errors.badRequest("Formato .doc antigo não suportado — salve como .docx, PDF ou texto.");
      } else {
        // txt, md, csv e afins: tratar como texto puro.
        text = buf.toString("utf8");
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("não suportado")) throw e;
      throw Errors.badRequest(`Não foi possível extrair o texto de "${name}". Tente colar o conteúdo manualmente.`);
    }

    // Remove bytes NUL/controle que PDF/Word costumam injetar — o Postgres os
    // rejeita ao salvar (22P05) e sujam o textarea de revisão.
    text = stripNul(text).replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) throw Errors.badRequest(`Nenhum texto encontrado em "${name}".`);

    // Título sugerido = nome do arquivo sem extensão.
    const title = name.replace(/\.[a-z0-9]+$/i, "").slice(0, 200);
    return ok({ title, text, chars: text.length });
  });
}
