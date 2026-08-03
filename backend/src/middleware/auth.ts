import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { config } from "../config/index.js";
import { unauthorized } from "../utils/errors.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Creator id, set by `requireCreator`. */
      userId?: number;
      /** Worker id, set by `requireWorker`. */
      workerId?: number;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  return token.trim() === "" ? null : token;
}

function verify<T extends object>(token: string, secret: string): (JwtPayload & T) | null {
  try {
    const decoded = jwt.verify(token, secret);
    return typeof decoded === "string" ? null : (decoded as JwtPayload & T);
  } catch {
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
export function requireCreator(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next(unauthorized());

  const decoded = verify<{ userId?: number }>(token, config.auth.jwtSecret);
  if (!decoded?.userId) return next(unauthorized());

  req.userId = decoded.userId;
  next();
}

export function requireWorker(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next(unauthorized());

  const decoded = verify<{ workerId?: number }>(token, config.auth.workerJwtSecret);
  if (!decoded?.workerId) return next(unauthorized());

  req.workerId = decoded.workerId;
  // Kept for compatibility with handlers that historically read `userId` for
  // both roles. Prefer `req.workerId` in new code.
  req.userId = decoded.workerId;
  next();
}
