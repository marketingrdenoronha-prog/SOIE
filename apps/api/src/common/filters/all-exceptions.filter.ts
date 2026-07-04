import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";
import { ZodError } from "zod";
import { logger } from "@soie/config";
import { TenantStore } from "../tenant/tenant-context.js";

/** Converts any thrown error into the standard `{ error }` envelope. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const traceId = TenantStore.get()?.traceId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "internal_error";
    let message = "Unexpected error";
    let details: unknown;

    if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      code = "validation_error";
      message = "Invalid request payload";
      details = exception.issues;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = httpCode(status);
      const body = exception.getResponse();
      message = typeof body === "string" ? body : (body as any).message ?? message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= 500) {
      logger.error({ err: exception, traceId }, "Unhandled error");
    }

    res.status(status).json({ error: { code, message, details, traceId } });
  }
}

function httpCode(status: number): string {
  const map: Record<number, string> = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    429: "rate_limited",
  };
  return map[status] ?? "error";
}
