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
    console.error("route error", err);
    return fail("internal_error", "Erro inesperado", 500);
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
