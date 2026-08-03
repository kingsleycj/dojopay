import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { unauthorized } from "../utils/errors.js";
function extractToken(req) {
    const header = req.headers.authorization;
    if (!header)
        return null;
    const token = header.startsWith("Bearer ") ? header.slice(7) : header;
    return token.trim() === "" ? null : token;
}
function verify(token, secret) {
    try {
        const decoded = jwt.verify(token, secret);
        return typeof decoded === "string" ? null : decoded;
    }
    catch {
        return null;
    }
}
/**
 * Creator authentication.
 *
 * Note the status code: the old middleware returned 403 for missing/invalid
 * credentials, which the frontend then had to special-case. Unauthenticated is
 * 401; 403 is reserved for authenticated-but-not-allowed.
 */
export function requireCreator(req, _res, next) {
    const token = extractToken(req);
    if (!token)
        return next(unauthorized());
    const decoded = verify(token, config.auth.jwtSecret);
    if (!decoded?.userId)
        return next(unauthorized());
    req.userId = decoded.userId;
    next();
}
export function requireWorker(req, _res, next) {
    const token = extractToken(req);
    if (!token)
        return next(unauthorized());
    const decoded = verify(token, config.auth.workerJwtSecret);
    if (!decoded?.workerId)
        return next(unauthorized());
    req.workerId = decoded.workerId;
    // Kept for compatibility with handlers that historically read `userId` for
    // both roles. Prefer `req.workerId` in new code.
    req.userId = decoded.workerId;
    next();
}
//# sourceMappingURL=auth.js.map