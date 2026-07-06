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
      return fail("validation_error", "Dados inválidos", 400, err.issues);
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
