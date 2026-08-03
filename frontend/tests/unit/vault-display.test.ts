import { describe, it, expect } from "vitest";
import { lamportsToSol, solToLamports } from "../../utils/convert";
import { buildVaultWithdrawalMessage, buildWithdrawalMessage } from "../../lib/api";

/**
 * Display and signing rules for the vault.
 *
 * These are the two places where a frontend/backend disagreement is invisible
 * until money is involved: a rendered figure that rounds wrongly, and a signed
 * message that does not match byte for byte.
 */

describe("lamportsToSol precision", () => {
  /**
   * Headline figures cap their precision — a dashboard stat reading
   * `0.001234567` is harder to scan than `0.0012`, and the extra digits are not
   * decision-relevant there.
   */
  it("caps decimals when asked", () => {
    expect(lamportsToSol(1_234_567, 4)).toBe("0.0012");
    expect(lamportsToSol(1_234_567, 6)).toBe("0.001234");
    expect(lamportsToSol(1_234_567)).toBe("0.001234567");
  });

  /** A capped render must never round *up* past what is actually held. */
  it("never rounds a balance up", () => {
    for (const decimals of [2, 4, 6]) {
      const shown = Number(lamportsToSol(1_999_999_999, decimals));
      expect(shown).toBeLessThanOrEqual(1_999_999_999 / 1e9);
    }
  });

  /**
   * Regression: the trailing-zero strip used to be able to eat significant
   * digits from a whole number, turning `100` into `1`.
   */
  it("does not strip significant zeros from whole numbers", () => {
    expect(lamportsToSol(100_000_000_000)).toBe("100");
    expect(lamportsToSol(10_000_000_000)).toBe("10");
    expect(lamportsToSol(100_000_000_000, 2)).toBe("100");
  });

  it("survives a non-numeric amount rather than rendering NaN", () => {
    expect(lamportsToSol("not-a-number")).toBe("0");
    expect(lamportsToSol("")).toBe("0");
  });

  it("truncates to whole SOL at zero decimals", () => {
    expect(lamportsToSol(1_500_000_000, 0)).toBe("1");
    expect(lamportsToSol(100_000_000, 0)).toBe("0");
  });

  /**
   * Above 2^53 a float loses lamport-level precision. The max task budget is
   * 1000 SOL and a platform-wide total can be far larger, so the conversion
   * works in BigInt rather than dividing into a double first.
   */
  it("stays exact past the safe-integer boundary", () => {
    expect(lamportsToSol("9007199254740993")).toBe("9007199.254740993");
    expect(lamportsToSol("1000000000000000000")).toBe("1000000000");
  });
});

describe("solToLamports", () => {
  it("floors rather than rounding, so a balance is never overstated", () => {
    expect(solToLamports("0.0000000019")).toBe(1);
    expect(solToLamports("1.5")).toBe(1_500_000_000);
  });

  /** Round-trips through the composer's budget field must not drift. */
  it("round-trips the composer defaults", () => {
    for (const sol of ["0.01", "0.1", "0.5", "1", "5"]) {
      expect(lamportsToSol(solToLamports(sol))).toBe(String(Number(sol)));
    }
  });
});

describe("withdrawal messages", () => {
  const ADDRESS = "8ZDbGsY7YJmSAvGHNRbnZQvfsyGgYw4mLUcQ6PPBpVHb";

  /**
   * These must match the backend byte for byte or the signature fails
   * verification — a mismatch surfaces as a bare 401 with nothing to debug.
   */
  it("matches the backend format for a worker payout", () => {
    expect(buildWithdrawalMessage("1000000", ADDRESS)).toBe(
      `Withdraw 1000000 lamports to ${ADDRESS}`,
    );
  });

  it("matches the backend format for a vault withdrawal", () => {
    expect(buildVaultWithdrawalMessage("1000000", ADDRESS)).toBe(
      `Withdraw 1000000 lamports from your DojoPay vault to ${ADDRESS}`,
    );
  });

  /**
   * The two must differ. Signing one message that could be replayed against the
   * other balance is exactly what distinct strings prevent.
   */
  it("cannot be replayed across the two balances", () => {
    expect(buildWithdrawalMessage("1000000", ADDRESS)).not.toBe(
      buildVaultWithdrawalMessage("1000000", ADDRESS),
    );
  });

  /** The amount is part of what is signed, so a captured signature is bounded. */
  it("names the exact amount", () => {
    expect(buildVaultWithdrawalMessage("1", ADDRESS)).not.toBe(
      buildVaultWithdrawalMessage("2", ADDRESS),
    );
  });
});
