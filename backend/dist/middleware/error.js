import { ZodError } from "zod";
import { logger } from "../lib/logger.js";
import { AppError } from "../utils/errors.js";
/** 404 for unmatched routes. Registered after all route tables. */
export function notFoundHandler(req, res) {
    res.status(404).json({
        message: `No route matches ${req.method} ${req.path}`,
        code: "ROUTE_NOT_FOUND",
    });
}
/**
 * Terminal error handler.
 *
 * Every controller is wrapped in `asyncHandler`, so thrown errors and rejected
 * promises both land here. This replaced ~20 hand-rolled try/catch blocks that
 * each invented their own response shape.
 */
export function errorHandler(error, req, res, 
// Express identifies error middleware by arity — `next` must stay declared.
_next) {
    if (error instanceof AppError) {
        if (error.status >= 500) {
            logger.error(error.message, { code: error.code, path: req.path, details: error.details });
        }
        return res.status(error.status).json({
            message: error.message,
            code: error.code,
            ...(error.details ? { details: error.details } : {}),
        });
    }
    if (error instanceof ZodError) {
        return res.status(400).json({
            message: "Invalid request payload",
            code: "VALIDATION_ERROR",
            issues: error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            })),
        });
    }
    // Prisma unique-constraint violation. Reached when two requests race past an
    // application-level check — the constraint is the real guarantee.
    if (typeof error === "object" && error !== null && error.code === "P2002") {
        return res.status(409).json({
            message: "That record already exists",
            code: "DUPLICATE",
            fields: error.meta?.target,
        });
    }
    logger.error("Unhandled error", {
        path: req.path,
        method: req.method,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({ message: "Internal server error", code: "INTERNAL_ERROR" });
}
/**
 * Wraps an async controller so rejections reach `errorHandler`.
 * Express 5 forwards rejected promises itself, but being explicit keeps the
 * behaviour independent of the Express version.
 */
export function asyncHandler(handler) {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}
//# sourceMappingURL=error.js.map