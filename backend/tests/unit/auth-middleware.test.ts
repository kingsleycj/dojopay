import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { config } from "../../src/config/index.js";
import { requireCreator, requireWorker } from "../../src/middleware/auth.js";
import { AppError } from "../../src/utils/errors.js";

function invoke(middleware: typeof requireCreator, authorization?: string) {
  const req = { headers: authorization ? { authorization } : {} } as unknown as Request;
  const res = {} as Response;
  const next = vi.fn() as unknown as NextFunction;

  middleware(req, res, next);

  return { req, next: next as unknown as ReturnType<typeof vi.fn> };
}

const creatorToken = jwt.sign({ userId: 7 }, config.auth.jwtSecret);
const workerToken = jwt.sign({ workerId: 9 }, config.auth.workerJwtSecret);

describe("requireCreator", () => {
  it("accepts a valid Bearer token and attaches the id", () => {
    const { req, next } = invoke(requireCreator, `Bearer ${creatorToken}`);
    expect(next).toHaveBeenCalledWith();
    expect(req.userId).toBe(7);
  });

  it("accepts a bare token without the Bearer prefix", () => {
    const { req } = invoke(requireCreator, creatorToken);
    expect(req.userId).toBe(7);
  });

  it("rejects a missing header with 401, not 403", () => {
    const { next } = invoke(requireCreator);
    const error = next.mock.calls[0][0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(401);
  });

  it("rejects a malformed token", () => {
    const { next } = invoke(requireCreator, "Bearer not-a-jwt");
    expect((next.mock.calls[0][0] as AppError).status).toBe(401);
  });

  it("rejects a token signed with the wrong secret", () => {
    const forged = jwt.sign({ userId: 7 }, "some-other-secret");
    const { next } = invoke(requireCreator, `Bearer ${forged}`);
    expect((next.mock.calls[0][0] as AppError).status).toBe(401);
  });

  /**
   * The two roles must not be interchangeable. Before the secrets were
   * separated properly this crossover was the whole vulnerability.
   */
  it("rejects a worker token", () => {
    const { next } = invoke(requireCreator, `Bearer ${workerToken}`);
    expect((next.mock.calls[0][0] as AppError).status).toBe(401);
  });

  it("rejects a token carrying no userId claim", () => {
    const empty = jwt.sign({ somethingElse: true }, config.auth.jwtSecret);
    const { next } = invoke(requireCreator, `Bearer ${empty}`);
    expect((next.mock.calls[0][0] as AppError).status).toBe(401);
  });
});

describe("requireWorker", () => {
  it("accepts a valid worker token", () => {
    const { req, next } = invoke(requireWorker, `Bearer ${workerToken}`);
    expect(next).toHaveBeenCalledWith();
    expect(req.workerId).toBe(9);
  });

  it("rejects a creator token", () => {
    const { next } = invoke(requireWorker, `Bearer ${creatorToken}`);
    expect((next.mock.calls[0][0] as AppError).status).toBe(401);
  });

  it("cannot be satisfied by a token forged from Express internals", () => {
    // The old worker secret was the stringified Express app plus "worker",
    // which any attacker could reproduce. Assert that shape no longer verifies.
    const guessedSecret = "function(req, res, next) { app.handle(req, res, next); }worker";
    const forged = jwt.sign({ workerId: 1 }, guessedSecret);
    const { next } = invoke(requireWorker, `Bearer ${forged}`);
    expect((next.mock.calls[0][0] as AppError).status).toBe(401);
  });
});
