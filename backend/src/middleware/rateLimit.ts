import type { NextFunction, Request, Response } from "express";
import { config } from "../config/index.js";

/**
 * In-process fixed-window rate limiter.
 *
 * The README claimed rate limiting existed; it did not. This closes the gap
 * without adding a dependency. It is per-process, so it does not hold across a
 * multi-instance deploy — acceptable while the backend runs as a single Render
 * instance, and the natural upgrade is a Redis-backed store.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Sweep expired buckets so the map cannot grow without bound under attack.
const SWEEP_INTERVAL_MS = 60_000;
let sweeper: NodeJS.Timeout | null = null;

function ensureSweeper() {
  if (sweeper || config.isTest) return;
  sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, SWEEP_INTERVAL_MS);
  sweeper.unref();
}

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Requests permitted per window per client. */
  max: number;
  /** Distinguishes limiters that share a client key. */
  name: string;
}

export function rateLimit({ windowMs, max, name }: RateLimitOptions) {
  ensureSweeper();

  return (req: Request, res: Response, next: NextFunction) => {
    if (config.isTest) return next();

    const client = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const key = `${name}:${client}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil((bucket.resetAt - now) / 1000)));

    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({
        message: "Too many requests, please slow down",
        code: "RATE_LIMITED",
      });
    }

    next();
  };
}

/** Sign-in performs ed25519 verification — cheap to call, worth bounding. */
export const authRateLimit = rateLimit({ name: "auth", windowMs: 60_000, max: 10 });

/** Payouts move real money and hit the RPC; keep them slow. */
export const payoutRateLimit = rateLimit({ name: "payout", windowMs: 60_000, max: 3 });

/** Task creation makes several RPC round-trips with retries. */
export const taskCreationRateLimit = rateLimit({ name: "task-create", windowMs: 60_000, max: 10 });

/** Broad default for everything else. */
export const generalRateLimit = rateLimit({ name: "general", windowMs: 60_000, max: 200 });
