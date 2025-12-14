import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from '../index.js';
import { WORKER_JWT_SECRET } from '../routers/worker.js';

// Extend the Request interface to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
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
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & { userId: number };
    
    if (decoded.userId) {
      req.userId = decoded.userId;
      return next();
    } else {
      return res.status(403).json({
        message: "You're not logged in!",
      });
    }
  } catch (error) {
    return res.status(403).json({
      message: "You're not logged in!",
    });
  }
}


export function workerAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
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
    const decoded = jwt.verify(token, WORKER_JWT_SECRET) as JwtPayload & { userId: number };
    
    if (decoded.userId) {
      req.userId = decoded.userId;
      return next();
    } else {
      return res.status(403).json({
        message: "You're not logged in!",
      });
    }
  } catch (error) {
    return res.status(403).json({
      message: "You're not logged in!",
    });
  }
}
