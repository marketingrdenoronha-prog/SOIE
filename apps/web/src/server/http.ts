import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** JSON success response. */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** Standard error envelope, matching the app's API contract. */
export function fail(code: string, message: string, status: number, details?: unknown): NextResponse {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

/** Wraps a handler, turning thrown errors into the standard envelope. */
export function handle(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  return fn().catch((err) => {
    if (err instanceof ZodError) {
      return fail("validation_error", zodErrorMessage(err), 400, err.issues);
    }
    if (err instanceof HttpError) {
      return fail(err.code, err.message, err.status);
    }
    // Corpo JSON malformado/vazio (req.json() lança SyntaxError) é erro do
    // cliente, não do servidor.
    if (err instanceof SyntaxError) {
      return fail("bad_request", "JSON inválido no corpo da requisição", 400);
    }
    // Erros conhecidos do Prisma: mapeados para o status certo em vez de 500.
    const code = (err as { code?: unknown })?.code;
    if (typeof code === "string") {
      // P2023: id/uuid malformado; P2025: registro não encontrado.
      if (code === "P2023" || code === "P2025") {
        return fail("not_found", "Recurso não encontrado", 404);
      }
      // P2003: FK inexistente; P2000/P2006/P2007: valor inválido para a coluna.
      if (code === "P2003" || code === "P2000" || code === "P2006" || code === "P2007") {
        return fail("bad_request", "Referência ou valor inválido", 400);
      }
      // P2002: violação de unique — requisição concorrente/duplicada.
      if (code === "P2002") {
        return fail("conflict", "Registro duplicado — a operação já foi executada", 409);
      }
    }
    console.error("route error", err);
    // Include the underlying error message so the client sees the real cause
    // (Prisma-not-connected, missing table, JWT-secret-missing, etc.) instead
    // of a useless "Erro inesperado" — no stack, no PII, safe to expose.
    const detail = err instanceof Error ? err.message : String(err);
    return fail("internal_error", detail || "Erro inesperado", 500);
  });
}

/** Rótulos amigáveis por chave de campo (onboarding e afins). Cai no próprio
 * caminho quando a chave não está mapeada — nunca mostra "Dados inválidos" seco. */
const FIELD_LABELS: Record<string, string> = {
  displayName: "Nome público",
  primaryObjective: "Objetivo principal",
  secondaryObjectives: "Objetivos secundários",
  successMetrics: "Métricas de sucesso",
  description: "Descrição do cliente ideal",
  demographics: "Perfil demográfico",
  painPoints: "Dores",
  desires: "Desejos",
  channelsWhereTheyAre: "Canais onde estão",
  tone: "Como a marca fala",
  doList: "Fazer",
  dontList: "Não fazer",
  referenceProfiles: "Perfis de referência",
  referenceExamples: "Textos de exemplo",
  differentiators: "Diferenciais",
  observations: "Observações",
  materialLinks: "Links",
};

/** Traduz o motivo de uma issue do Zod para PT, com o limite quando houver. */
function zodReason(issue: ZodError["issues"][number]): string {
  const i = issue as { code?: string; type?: string; maximum?: number; minimum?: number };
  if (i.code === "too_big") {
    if (i.type === "array") return `máximo de ${i.maximum} itens`;
    return `passou do limite de ${i.maximum} caracteres`;
  }
  if (i.code === "too_small") {
    if (i.type === "array") return `mínimo de ${i.minimum} itens`;
    if (i.minimum === 1) return "campo obrigatório";
    return `mínimo de ${i.minimum} caracteres`;
  }
  if (i.code === "invalid_enum_value") return "valor não permitido";
  if (i.code === "invalid_type") return "tipo inválido ou vazio";
  if (i.code === "invalid_string") return "formato inválido";
  return issue.message;
}

/** Monta uma mensagem legível a partir do 1º erro de validação: qual campo e
 * por quê — em vez do genérico "Dados inválidos". */
function zodErrorMessage(err: ZodError): string {
  const first = err.issues[0];
  if (!first) return "Dados inválidos";
  // Último segmento de texto do caminho = a chave do campo (ignora índices).
  const keys = first.path.filter((p): p is string => typeof p === "string" && p !== "payload");
  const key = keys[keys.length - 1];
  const field = (key && FIELD_LABELS[key]) || keys.join(" › ") || "campo";
  const extra = err.issues.length > 1 ? ` (e mais ${err.issues.length - 1})` : "";
  return `Dados inválidos — ${field}: ${zodReason(first)}${extra}`;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const Errors = {
  unauthorized: () => new HttpError(401, "unauthorized", "Autenticação necessária"),
  forbidden: () => new HttpError(403, "forbidden", "Acesso negado"),
  notFound: (what = "Recurso") => new HttpError(404, "not_found", `${what} não encontrado`),
  conflict: (msg: string) => new HttpError(409, "conflict", msg),
  gone: (msg: string) => new HttpError(410, "gone", msg),
  badRequest: (msg: string) => new HttpError(400, "bad_request", msg),
};
