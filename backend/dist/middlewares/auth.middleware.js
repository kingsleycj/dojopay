import jwt from "jsonwebtoken";
import { JWT_SECRET } from '../index.js';
import { WORKER_JWT_SECRET } from '../routers/worker.js';
export function authMiddleware(req, res, next) {
    const authHeader = req.headers["authorization"] ?? "";
    if (!authHeader) {
        return res.status(403).json({
            message: "You're not logged in!",
        });
    }
    // Extract token from "Bearer <token>" format
    const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.userId) {
            req.userId = decoded.userId;
            return next();
        }
        else {
            return res.status(403).json({
                message: "You're not logged in!",
            });
        }
    }
    catch (error) {
        return res.status(403).json({
            message: "You're not logged in!",
        });
    }
}
export function workerAuthMiddleware(req, res, next) {
    const authHeader = req.headers["authorization"] ?? "";
    if (!authHeader) {
        return res.status(403).json({
            message: "You're not logged in!",
        });
    }
    // Extract token from "Bearer <token>" format
    const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader;
    try {
        const decoded = jwt.verify(token, WORKER_JWT_SECRET);
        if (decoded.workerId) {
            req.userId = decoded.workerId;
            return next();
        }
        else {
            return res.status(403).json({
                message: "You're not logged in!",
            });
        }
    }
    catch (error) {
        return res.status(403).json({
            message: "You're not logged in!",
        });
    }
}
//# sourceMappingURL=auth.middleware.js.map