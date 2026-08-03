import { describe, it, expect } from "vitest";
import {
  MAX_SUBMISSIONS_PER_TASK,
  MIN_WITHDRAWAL_LAMPORTS,
  REWARD_PER_SUBMISSION_LAMPORTS,
  TASK_PRICE_LAMPORTS,
  assertConfigValid,
  config,
} from "../../src/config/index.js";

describe("config", () => {
  it("loads both JWT secrets from the environment", () => {
    expect(config.auth.jwtSecret).toBe("test-creator-secret");
    expect(config.auth.workerJwtSecret).toBe("test-worker-secret");
  });

  /**
   * Regression guard for the original bug: the worker secret was produced by
   * default-importing `index.ts`, which exports the Express app. The secret was
   * therefore the app function's source text.
   */
  it("does not derive the worker secret from the creator secret or an object", () => {
    expect(config.auth.workerJwtSecret).not.toBe(config.auth.jwtSecret);
    expect(config.auth.workerJwtSecret).not.toContain("[object");
    expect(config.auth.workerJwtSecret).not.toContain("function");
    expect(config.auth.workerJwtSecret.endsWith("worker")).toBe(false);
  });

  it("rejects a configuration where both secrets match", () => {
    const original = config.auth.workerJwtSecret;
    // @ts-expect-error deliberately violating readonly to exercise the guard
    config.auth.workerJwtSecret = config.auth.jwtSecret;

    expect(() => assertConfigValid()).toThrow(/must differ/);

    // @ts-expect-error restoring
    config.auth.workerJwtSecret = original;
    expect(() => assertConfigValid()).not.toThrow();
  });

  it("keeps the reward derivable from price and cap", () => {
    expect(TASK_PRICE_LAMPORTS).toBe(100_000_000);
    expect(MAX_SUBMISSIONS_PER_TASK).toBe(100);
    expect(REWARD_PER_SUBMISSION_LAMPORTS).toBe(1_000_000n);

    // The invariant that keeps the platform solvent: paying every slot must
    // never cost more than the task was funded for.
    expect(REWARD_PER_SUBMISSION_LAMPORTS * BigInt(MAX_SUBMISSIONS_PER_TASK)).toBe(
      BigInt(TASK_PRICE_LAMPORTS),
    );
  });

  it("sets a withdrawal minimum above the network fee", () => {
    expect(MIN_WITHDRAWAL_LAMPORTS).toBeGreaterThan(5_000n);
  });
});
