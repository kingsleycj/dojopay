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
  it("loads the account and admin secrets from the environment", () => {
    expect(config.auth.jwtSecret).toBe("test-account-secret");
    expect(config.auth.adminJwtSecret).toBe("test-admin-secret");
  });

  /**
   * The admin API reads every user's data, so its secret must be independent.
   * A shared secret would let any user token be replayed against `/v1/admin`.
   */
  it("rejects a configuration where the user and admin secrets match", () => {
    const original = config.auth.adminJwtSecret;
    // @ts-expect-error deliberately violating readonly to exercise the guard
    config.auth.adminJwtSecret = config.auth.jwtSecret;

    expect(() => assertConfigValid()).toThrow(/must differ/);

    // @ts-expect-error restoring
    config.auth.adminJwtSecret = original;
    expect(() => assertConfigValid()).not.toThrow();
  });

  /**
   * Regression guard for the original bug: the worker secret used to be derived
   * by default-importing `index.ts`, which exports the Express app — making the
   * "secret" Express's own source text.
   */
  it("has no secret derived from an object or the other secret", () => {
    for (const secret of [config.auth.jwtSecret, config.auth.adminJwtSecret]) {
      expect(secret).not.toContain("[object");
      expect(secret).not.toContain("function");
    }
    expect(config.auth.jwtSecret).not.toBe(config.auth.adminJwtSecret);
  });

  it("gives admin sessions a shorter life than user sessions", () => {
    expect(config.auth.adminTokenTtl).toBe("8h");
    expect(config.auth.tokenTtl).toBe("7d");
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
