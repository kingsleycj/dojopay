/**
 * Typed application errors.
 *
 * Services throw these; the error middleware maps them to responses. Controllers
 * do not hand-build error bodies — the old routers had 20+ near-identical
 * try/catch blocks each inventing its own shape and status code.
 */
export class AppError extends Error {
    status;
    code;
    details;
    constructor(status, message, code, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.name = "AppError";
    }
}
export const badRequest = (message, code = "BAD_REQUEST", details) => new AppError(400, message, code, details);
export const unauthorized = (message = "You're not logged in!", code = "UNAUTHORIZED") => new AppError(401, message, code);
export const forbidden = (message, code = "FORBIDDEN") => new AppError(403, message, code);
export const notFound = (message, code = "NOT_FOUND") => new AppError(404, message, code);
export const conflict = (message, code = "CONFLICT", details) => new AppError(409, message, code, details);
export const serverError = (message, code = "INTERNAL_ERROR", details) => new AppError(500, message, code, details);
//# sourceMappingURL=errors.js.map