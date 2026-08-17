import { createHash } from "node:crypto";

/**
 * Normalização, checksum e chunking do conteúdo da Base de Conhecimento.
 * Chunking semanticamente razoável: agrupa parágrafos até um teto de tamanho,
 * com overlap moderado, evitando quebrar frases no meio. Cada chunk vira uma
 * unidade de recuperação (Embedding).
 */

/** Remove NUL/control chars (Postgres rejeita), normaliza espaços e quebras. */
export function normalizeText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    // Remove NUL e control chars (menos \n \t) — Postgres rejeita 0x00 (22P05).
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    // Espacos "invisiveis" (nbsp, zero-width, BOM) viram espaco normal.
    .replace(/[\u00A0\u200B\uFEFF]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function checksum(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/** Aproximação de tokens (~4 chars/token) — suficiente para orçar contexto. */
export function approxTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

const MAX_CHARS = 1200; // ~300 tokens por chunk
const OVERLAP_CHARS = 180;

/** Divide o texto em parágrafos e agrupa até o teto, com overlap moderado. */
export function chunkText(input: string, maxChars = MAX_CHARS, overlap = OVERLAP_CHARS): string[] {
  const text = normalizeText(input);
  if (!text) return [];
  if (text.length <= maxChars) return [text];

  // Unidades = parágrafos; parágrafo grande é quebrado por frases.
  const paras = text.split(/\n{2,}/).flatMap((p) => (p.length <= maxChars ? [p] : splitSentences(p, maxChars)));

  const chunks: string[] = [];
  let buf = "";
  for (const unit of paras) {
    if (!buf) {
      buf = unit;
    } else if (buf.length + unit.length + 2 <= maxChars) {
      buf += "\n\n" + unit;
    } else {
      chunks.push(buf);
      // overlap: começa o próximo chunk com o fim do anterior.
      const tail = buf.slice(-overlap);
      buf = (tail ? tail + "\n\n" : "") + unit;
      if (buf.length > maxChars) {
        // unit sozinha já estoura → empurra sem overlap.
        chunks.push(buf.slice(0, maxChars));
        buf = unit.slice(0, maxChars);
      }
    }
  }
  if (buf.trim()) chunks.push(buf);
  return chunks.map((c) => c.trim()).filter(Boolean);
}

function splitSentences(para: string, maxChars: number): string[] {
  const sentences = para.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) ?? [para];
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (buf.length + s.length <= maxChars) {
      buf += s;
    } else {
      if (buf.trim()) out.push(buf.trim());
      buf = s.length > maxChars ? s.slice(0, maxChars) : s;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
