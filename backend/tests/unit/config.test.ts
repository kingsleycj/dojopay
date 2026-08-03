import { describe, it, expect } from "vitest";
import {
  DEFAULT_SUBMISSIONS_PER_TASK,
  MAX_SUBMISSIONS_PER_TASK,
  MAX_TASK_BUDGET_LAMPORTS,
  MIN_DEPOSIT_LAMPORTS,
  MIN_REWARD_PER_SUBMISSION_LAMPORTS,
  MIN_SUBMISSIONS_PER_TASK,
  MIN_TASK_BUDGET_LAMPORTS,
  MIN_WITHDRAWAL_LAMPORTS,
  TASK_PRICE_LAMPORTS,
  assertConfigValid,
  config,
  isAdminEnabled,
  isOriginAllowed,
} from "../../src/config/index.js";

/** Temporarily override a readonly config value for the duration of a check. */
function withAdminSecret(value: string, run: () => void) {
  const original = config.auth.adminJwtSecret;
  // @ts-expect-error deliberately violating readonly in a test
  config.auth.adminJwtSecret = value;
  try {
    run();
  } finally {
    // @ts-expect-error restoring
    config.auth.adminJwtSecret = original;
  }
}

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
    withAdminSecret(config.auth.jwtSecret, () => {
      expect(() => assertConfigValid()).toThrow(/must differ/);
    });
    expect(() => assertConfigValid()).not.toThrow();
  });
});

/**
 * Deploy safety.
 *
 * A deployment that has not yet been given the new variables must keep serving
 * users. Anything merely missing degrades to a warning; only a genuinely unsafe
 * combination is fatal, because an outage is worse than a disabled admin panel.
 */
describe("degradation instead of failure", () => {
  it("boots without ADMIN_JWT_SECRET and disables the admin API", () => {
    withAdminSecret("", () => {
      expect(() => assertConfigValid()).not.toThrow();
      expect(isAdminEnabled()).toBe(false);
      expect(assertConfigValid().join(" ")).toMatch(/admin API .* is disabled/i);
    });
  });

  it("enables the admin API once a distinct secret is set", () => {
    withAdminSecret("a-separate-admin-secret", () => {
      expect(isAdminEnabled()).toBe(true);
    });
  });

  /** A shared secret must disable admin, never silently accept user tokens. */
  it("refuses to enable the admin API on a shared secret", () => {
    withAdminSecret(config.auth.jwtSecret, () => {
      expect(isAdminEnabled()).toBe(false);
    });
  });

  /**
   * The warning must be driven by the config value, not by whether the machine
   * running the suite happens to have a key in its `.env` — dotenv loads that
   * file under test too, so this previously passed or failed depending on who
   * ran it.
   */
  it("warns rather than throws when email is unconfigured", () => {
    const original = config.mail.resendApiKey;
    // @ts-expect-error deliberately violating readonly in a test
    config.mail.resendApiKey = "";
    try {
      expect(() => assertConfigValid()).not.toThrow();
      expect(assertConfigValid().join(" ")).toMatch(/RESEND_API_KEY/);
    } finally {
      // @ts-expect-error restoring the readonly value
      config.mail.resendApiKey = original;
    }
  });

  it("stops warning about email once a key is configured", () => {
    const original = config.mail.resendApiKey;
    // @ts-expect-error deliberately violating readonly in a test
    config.mail.resendApiKey = "re_test_key";
    try {
      expect(assertConfigValid().join(" ")).not.toMatch(/RESEND_API_KEY/);
    } finally {
      // @ts-expect-error restoring the readonly value
      config.mail.resendApiKey = original;
    }
  });

  /**
   * Keeps the historical value so an existing deployment behaves identically
   * without needing a new variable. It is a public address, not a secret.
   */
  it("defaults the platform wallet to the previously hardcoded address", () => {
    expect(config.solana.platformWalletAddress).toBe(
      "FPDb9L6L3kyBiw8LeXCcdza85PbSNxcZujXNkPrwEont",
    );
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

  /**
   * The reward is no longer a global constant — creators choose a budget and a
   * slot count per task, so what config pins down is the *range* those choices
   * may fall in. `planBudget` enforces it; these assertions keep the bounds
   * from being widened into something that pays dust or strands SOL.
   */
  it("bounds task budgets so neither end of the trade-off pays dust", () => {
    expect(MIN_TASK_BUDGET_LAMPORTS).toBeLessThan(MAX_TASK_BUDGET_LAMPORTS);
    expect(MIN_SUBMISSIONS_PER_TASK).toBeLessThan(MAX_SUBMISSIONS_PER_TASK);

    // A worker's reward must clear the ~5000-lamport fee they eventually pay to
    // withdraw it, or the work costs more to collect than it pays.
    expect(MIN_REWARD_PER_SUBMISSION_LAMPORTS).toBeGreaterThan(5_000n);

    // The smallest legal task must still be able to pay its smallest legal
    // split. If this fails, some budgets are accepted that no slot count can
    // satisfy — a task nobody can create.
    expect(MIN_TASK_BUDGET_LAMPORTS / BigInt(MIN_SUBMISSIONS_PER_TASK)).toBeGreaterThanOrEqual(
      MIN_REWARD_PER_SUBMISSION_LAMPORTS,
    );
  });

  it("keeps the composer defaults inside the permitted range", () => {
    expect(BigInt(TASK_PRICE_LAMPORTS)).toBeGreaterThanOrEqual(MIN_TASK_BUDGET_LAMPORTS);
    expect(BigInt(TASK_PRICE_LAMPORTS)).toBeLessThanOrEqual(MAX_TASK_BUDGET_LAMPORTS);
    expect(DEFAULT_SUBMISSIONS_PER_TASK).toBeGreaterThanOrEqual(MIN_SUBMISSIONS_PER_TASK);
    expect(DEFAULT_SUBMISSIONS_PER_TASK).toBeLessThanOrEqual(MAX_SUBMISSIONS_PER_TASK);
  });

  it("sets a withdrawal minimum above the network fee", () => {
    expect(MIN_WITHDRAWAL_LAMPORTS).toBeGreaterThan(5_000n);
  });

  /** A deposit that cannot fund even the smallest task is a support ticket. */
  it("sets a deposit minimum that can fund at least the smallest task", () => {
    expect(MIN_DEPOSIT_LAMPORTS).toBeGreaterThanOrEqual(MIN_TASK_BUDGET_LAMPORTS);
  });
});

/**
 * CORS.
 *
 * A blocked request looks identical to a failed one in the browser, so an
 * over-tight origin rule presents as "features mysteriously do not work"
 * rather than as an error anyone can act on. Development is permissive for
 * localhost; production is not.
 */
describe("isOriginAllowed", () => {
  it("allows the explicitly listed origins", () => {
    expect(isOriginAllowed("http://localhost:5174")).toBe(true);
    expect(isOriginAllowed("https://dojopay.vercel.app")).toBe(true);
  });

  /** curl, server-to-server, and same-origin requests send no Origin header. */
  it("allows a request with no Origin", () => {
    expect(isOriginAllowed(undefined)).toBe(true);
  });

  /** The bug this fixes: any dev port silently broke every API call. */
  it("allows localhost on an unlisted port in development", () => {
    expect(isOriginAllowed("http://localhost:5240")).toBe(true);
    expect(isOriginAllowed("http://127.0.0.1:8080")).toBe(true);
  });

  it("rejects a non-localhost origin even in development", () => {
    expect(isOriginAllowed("https://evil.example")).toBe(false);
  });

  /** A hostname merely *containing* "localhost" must not pass. */
  it("rejects lookalike hostnames", () => {
    expect(isOriginAllowed("https://localhost.evil.example")).toBe(false);
    expect(isOriginAllowed("https://notlocalhost")).toBe(false);
  });

  it("rejects a malformed origin", () => {
    expect(isOriginAllowed("not a url")).toBe(false);
  });
});
