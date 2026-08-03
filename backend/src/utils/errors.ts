/**
 * Typed application errors.
 *
 * Services throw these; the error middleware maps them to responses. Controllers
 * do not hand-build error bodies — the old routers had 20+ near-identical
 * try/catch blocks each inventing its own shape and status code.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, code = "BAD_REQUEST", details?: Record<string, unknown>) =>
  new AppError(400, message, code, details);

export const unauthorized = (message = "You're not logged in!", code = "UNAUTHORIZED") =>
  new AppError(401, message, code);

export const forbidden = (message: string, code = "FORBIDDEN") => new AppError(403, message, code);

export const notFound = (message: string, code = "NOT_FOUND") => new AppError(404, message, code);

export const conflict = (message: string, code = "CONFLICT", details?: Record<string, unknown>) =>
  new AppError(409, message, code, details);

export const serverError = (message: string, code = "INTERNAL_ERROR", details?: Record<string, unknown>) =>
  new AppError(500, message, code, details);
