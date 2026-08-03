import { describe, it, expect } from "vitest";
import {
  generateToken,
  hashPassword,
  hashToken,
  safeEqual,
  validatePasswordStrength,
  verifyPassword,
} from "../../src/lib/password.js";
import { createTotpSecret, buildTotpUri, verifyTotp } from "../../src/lib/totp.js";

describe("password hashing", () => {
  it("produces an argon2id hash that verifies", async () => {
    const hash = await hashPassword("a-perfectly-fine-passphrase");

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, "a-perfectly-fine-passphrase")).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("a-perfectly-fine-passphrase");
    expect(await verifyPassword(hash, "not-the-password")).toBe(false);
  });

  /** Salted, so two people with the same password do not share a hash. */
  it("salts, so identical passwords hash differently", async () => {
    const a = await hashPassword("identical-passphrase-here");
    const b = await hashPassword("identical-passphrase-here");
    expect(a).not.toBe(b);
  });

  it("treats a malformed hash as a failed verification, not a crash", async () => {
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
    expect(await verifyPassword("", "anything")).toBe(false);
  });
});

describe("password policy", () => {
  it("accepts a reasonable passphrase", () => {
    expect(validatePasswordStrength("correct horse battery")).toBeNull();
  });

  it("rejects anything too short", () => {
    expect(validatePasswordStrength("short")).toMatch(/at least 10/);
  });

  it("rejects digit-only passwords", () => {
    expect(validatePasswordStrength("1234567890123")).toMatch(/only numbers/);
  });

  it("rejects passwords containing obvious guesses", () => {
    expect(validatePasswordStrength("mypassword123")).toMatch(/too easy/);
    expect(validatePasswordStrength("dojopay-rocks")).toMatch(/too easy/);
  });

  it("rejects absurdly long input, which is a DoS vector against argon2", () => {
    expect(validatePasswordStrength("a".repeat(500))).toMatch(/at most 200/);
  });
});

describe("verification tokens", () => {
  /**
   * Only the hash is stored. A leaked database dump must not hand anyone a
   * working password-reset link.
   */
  it("returns a token whose stored form is a hash, not the token", () => {
    const { token, tokenHash } = generateToken();

    expect(token.length).toBeGreaterThan(30);
    expect(tokenHash).not.toBe(token);
    expect(tokenHash).toBe(hashToken(token));
  });

  it("is URL-safe, so it survives being put in a link", () => {
    const { token } = generateToken();
    expect(token).toBe(encodeURIComponent(token));
  });

  it("does not repeat", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateToken().token));
    expect(tokens.size).toBe(200);
  });

  it("hashes deterministically so lookup works", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});

describe("safeEqual", () => {
  it("matches identical strings", () => {
    expect(safeEqual("token-value", "token-value")).toBe(true);
  });

  it("rejects different strings, including different lengths", () => {
    expect(safeEqual("token-value", "token-valuf")).toBe(false);
    expect(safeEqual("short", "much-longer-value")).toBe(false);
  });
});

describe("TOTP", () => {
  it("generates a base32 secret", () => {
    const secret = createTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(16);
  });

  it("builds an otpauth URI an authenticator app can scan", () => {
    const uri = buildTotpUri(createTotpSecret(), "owner@dojopay.io");

    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("DojoPay");
    expect(uri).toContain("secret=");
  });

  it("rejects a wrong code", () => {
    expect(verifyTotp(createTotpSecret(), "000000")).toBe(false);
  });

  it("treats malformed input as invalid rather than throwing", () => {
    expect(verifyTotp("not-base32!", "123456")).toBe(false);
    expect(verifyTotp(createTotpSecret(), "abc")).toBe(false);
    expect(verifyTotp(createTotpSecret(), "")).toBe(false);
  });
});
