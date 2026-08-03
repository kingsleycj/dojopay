import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/prisma.js", () => ({
  prismaClient: {
    account: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    verificationToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    worker: { findUnique: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (ops: unknown) => (Array.isArray(ops) ? ops : [])),
  },
  connectDB: vi.fn(),
  disconnectDB: vi.fn(),
}));

const sentEmails: Array<{ to: string; subject: string }> = [];
vi.mock("../../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn(async (to: string) => {
    sentEmails.push({ to, subject: "verify" });
  }),
  sendPasswordResetEmail: vi.fn(async (to: string) => {
    sentEmails.push({ to, subject: "reset" });
  }),
  sendWelcomeEmail: vi.fn(async (to: string) => {
    sentEmails.push({ to, subject: "welcome" });
  }),
  sendAccountSuspendedEmail: vi.fn(),
  getMailer: vi.fn(),
  __setMailer: vi.fn(),
}));

vi.mock("tweetnacl", () => ({
  default: { sign: { detached: { verify: vi.fn(() => true) } } },
}));

const { prismaClient } = await import("../../src/lib/prisma.js");
const accounts = await import("../../src/services/account.service.js");
const nacl = (await import("tweetnacl")).default as any;

const prisma = prismaClient as any;
const WALLET = "FPDb9L6L3kyBiw8LeXCcdza85PbSNxcZujXNkPrwEont";
const OTHER_WALLET = "8ZDbGsY7YJmSAvGHNRbnZQvfsyGgYw4mLUcQ6PPBpVHb";

function account(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    email: "worker@example.com",
    emailVerified: true,
    passwordHash: "$argon2id$hash",
    googleId: null,
    displayName: "Worker",
    avatarUrl: null,
    walletAddress: null,
    walletLinkedAt: null,
    signupProvider: "EMAIL",
    welcomeEmailSentAt: null,
    defaultMode: "WORKER",
    notifyTaskActivity: true,
    notifyPayouts: true,
    notifyProductNews: false,
    lastLoginAt: null,
    status: "ACTIVE",
    statusReason: null,
    referredBy: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    creatorProfile: null,
    workerProfile: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sentEmails.length = 0;
  nacl.sign.detached.verify.mockReturnValue(true);
});

describe("toPublicAccount", () => {
  /** The single most important property of this function. */
  it("never exposes credential material", () => {
    const publicView = accounts.toPublicAccount(
      account({ passwordHash: "$argon2id$secret", googleId: "google-123" }) as any,
    );

    const serialised = JSON.stringify(publicView);
    expect(serialised).not.toContain("argon2");
    expect(serialised).not.toContain("google-123");
    expect(publicView).not.toHaveProperty("passwordHash");
    expect(publicView).not.toHaveProperty("googleId");
  });

  it("reports which credentials exist without revealing them", () => {
    const publicView = accounts.toPublicAccount(
      account({ passwordHash: "$argon2id$x", googleId: "g" }) as any,
    );

    expect(publicView.hasPassword).toBe(true);
    expect(publicView.hasGoogle).toBe(true);
  });

  /** Drives the "connect a wallet to withdraw" prompt in the UI. */
  it("derives canWithdraw from a linked wallet", () => {
    expect(accounts.toPublicAccount(account({ walletAddress: null }) as any).canWithdraw).toBe(
      false,
    );
    expect(accounts.toPublicAccount(account({ walletAddress: WALLET }) as any).canWithdraw).toBe(
      true,
    );
  });

  it("reports which role profiles exist", () => {
    const publicView = accounts.toPublicAccount(
      account({ creatorProfile: { id: 1 }, workerProfile: null }) as any,
    );

    expect(publicView.roles).toEqual({ creator: true, worker: false });
  });
});

describe("buildWalletChallenge", () => {
  /** The nonce is what stops a captured signature being replayed. */
  it("embeds the nonce and states the purpose", () => {
    const message = accounts.buildWalletChallenge("abc123", "signin");

    expect(message).toContain("abc123");
    expect(message).toContain("Sign in to DojoPay");
    expect(message).toContain("will not trigger a transaction");
  });

  it("uses different wording for signing in and linking", () => {
    expect(accounts.buildWalletChallenge("n", "signin")).not.toBe(
      accounts.buildWalletChallenge("n", "link"),
    );
    expect(accounts.buildWalletChallenge("n", "link")).toContain("Link this wallet");
  });
});

describe("registerWithEmail", () => {
  it("refuses a weak password before touching the database", async () => {
    await expect(
      accounts.registerWithEmail({ email: "a@b.com", password: "password" }),
    ).rejects.toMatchObject({ code: "WEAK_PASSWORD" });

    expect(prisma.account.create).not.toHaveBeenCalled();
  });

  it("refuses a duplicate email", async () => {
    prisma.account.findUnique.mockResolvedValue(account());

    await expect(
      accounts.registerWithEmail({ email: "worker@example.com", password: "a-good-passphrase" }),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
  });

  it("lowercases the email so casing cannot create duplicates", async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    prisma.account.create.mockResolvedValue(account());

    await accounts.registerWithEmail({
      email: "  Worker@Example.COM ",
      password: "a-good-passphrase",
    });

    expect(prisma.account.create.mock.calls[0][0].data.email).toBe("worker@example.com");
  });

  it("stores a hash, never the password", async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    prisma.account.create.mockResolvedValue(account());

    await accounts.registerWithEmail({ email: "a@b.com", password: "a-good-passphrase" });

    const data = prisma.account.create.mock.calls[0][0].data;
    expect(data.passwordHash).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(data)).not.toContain("a-good-passphrase");
  });

  it("sends a verification email", async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    prisma.account.create.mockResolvedValue(account());

    await accounts.registerWithEmail({ email: "a@b.com", password: "a-good-passphrase" });

    expect(sentEmails).toContainEqual({ to: "a@b.com", subject: "verify" });
  });
});

describe("linkWallet", () => {
  it("refuses a wallet already used by another account", async () => {
    prisma.account.findUnique
      .mockResolvedValueOnce(account({ walletAddress: null }))
      .mockResolvedValueOnce(account({ id: 99, walletAddress: WALLET }));

    await expect(
      accounts.linkWallet(1, { walletAddress: WALLET, signature: "sig", nonce: "abc12345" }),
    ).rejects.toMatchObject({ code: "WALLET_IN_USE" });
  });

  it("refuses to overwrite an already-linked wallet", async () => {
    prisma.account.findUnique.mockResolvedValue(account({ walletAddress: OTHER_WALLET }));

    await expect(
      accounts.linkWallet(1, { walletAddress: WALLET, signature: "sig", nonce: "abc12345" }),
    ).rejects.toMatchObject({ code: "WALLET_ALREADY_LINKED" });
  });

  /** Ownership is proven, never asserted. */
  it("refuses an unverifiable signature", async () => {
    nacl.sign.detached.verify.mockReturnValue(false);

    await expect(
      accounts.linkWallet(1, { walletAddress: WALLET, signature: "sig", nonce: "abc12345" }),
    ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });

    expect(prisma.account.update).not.toHaveBeenCalled();
  });
});

describe("unlinkWallet", () => {
  /** Removing the destination while money is owed would strand the earnings. */
  it("refuses while the worker has a pending balance", async () => {
    prisma.account.findUnique.mockResolvedValue(
      account({
        walletAddress: WALLET,
        passwordHash: "$argon2id$x",
        workerProfile: { pending_amount: 5_000_000n },
      }),
    );

    await expect(accounts.unlinkWallet(1)).rejects.toMatchObject({ code: "PENDING_BALANCE" });
  });

  /** Otherwise a wallet-only account would lock itself out permanently. */
  it("refuses when the wallet is the only way to sign in", async () => {
    prisma.account.findUnique.mockResolvedValue(
      account({
        walletAddress: WALLET,
        email: null,
        passwordHash: null,
        googleId: null,
        workerProfile: null,
      }),
    );

    await expect(accounts.unlinkWallet(1)).rejects.toMatchObject({
      code: "WALLET_IS_ONLY_CREDENTIAL",
    });
  });

  it("allows unlinking when another credential exists and nothing is owed", async () => {
    prisma.account.findUnique.mockResolvedValue(
      account({
        walletAddress: WALLET,
        passwordHash: "$argon2id$x",
        workerProfile: { pending_amount: 0n },
      }),
    );
    prisma.account.update.mockResolvedValue(account({ walletAddress: null }));

    await expect(accounts.unlinkWallet(1)).resolves.toMatchObject({ walletAddress: null });
  });
});

describe("requestPasswordReset", () => {
  /**
   * Unlike registration, this endpoint is unauthenticated and trivially
   * scriptable, so a truthful "no such account" would enumerate registered
   * emails. The response is identical either way.
   */
  it("returns the same message whether or not the account exists", async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    const missing = await accounts.requestPasswordReset("nobody@example.com");

    prisma.account.findUnique.mockResolvedValue(account());
    const present = await accounts.requestPasswordReset("worker@example.com");

    expect(missing.message).toBe(present.message);
  });

  it("sends nothing for an unknown address", async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    await accounts.requestPasswordReset("nobody@example.com");
    expect(sentEmails).toHaveLength(0);
  });

  it("sends a reset link for a known address", async () => {
    prisma.account.findUnique.mockResolvedValue(account());
    await accounts.requestPasswordReset("worker@example.com");
    expect(sentEmails).toContainEqual({ to: "worker@example.com", subject: "reset" });
  });

  /** Only the hash is persisted. */
  it("stores a hashed token, not the token itself", async () => {
    prisma.account.findUnique.mockResolvedValue(account());
    await accounts.requestPasswordReset("worker@example.com");

    const stored = prisma.verificationToken.create.mock.calls[0][0].data;
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored).not.toHaveProperty("token");
  });
});

describe("resetPassword", () => {
  it("rejects an expired token", async () => {
    prisma.verificationToken.findUnique.mockResolvedValue({
      id: 1,
      account_id: 1,
      type: "PASSWORD_RESET",
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(accounts.resetPassword("tok", "a-good-passphrase")).rejects.toMatchObject({
      code: "TOKEN_EXPIRED",
    });
  });

  it("rejects a token that has already been used", async () => {
    prisma.verificationToken.findUnique.mockResolvedValue({
      id: 1,
      account_id: 1,
      type: "PASSWORD_RESET",
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(accounts.resetPassword("tok", "a-good-passphrase")).rejects.toMatchObject({
      code: "TOKEN_USED",
    });
  });

  /** A verification token must not be usable to change a password. */
  it("rejects a token of the wrong type", async () => {
    prisma.verificationToken.findUnique.mockResolvedValue({
      id: 1,
      account_id: 1,
      type: "EMAIL_VERIFICATION",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(accounts.resetPassword("tok", "a-good-passphrase")).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
  });

  it("rejects an unknown token", async () => {
    prisma.verificationToken.findUnique.mockResolvedValue(null);

    await expect(accounts.resetPassword("tok", "a-good-passphrase")).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
  });

  it("validates the new password before consuming the token", async () => {
    await expect(accounts.resetPassword("tok", "weak")).rejects.toMatchObject({
      code: "WEAK_PASSWORD",
    });
    expect(prisma.verificationToken.findUnique).not.toHaveBeenCalled();
  });
});

describe("role profiles", () => {
  it("creates a worker profile lazily on first use", async () => {
    prisma.worker.findUnique.mockResolvedValue(null);
    prisma.worker.create.mockResolvedValue({ id: 5 });

    await accounts.ensureWorkerProfile(1);

    expect(prisma.worker.create).toHaveBeenCalledWith({
      data: { account_id: 1, pending_amount: 0n, withdrawn_amount: 0n },
    });
  });

  it("does not create a second profile", async () => {
    prisma.worker.findUnique.mockResolvedValue({ id: 5 });

    await accounts.ensureWorkerProfile(1);

    expect(prisma.worker.create).not.toHaveBeenCalled();
  });

  it("creates a creator profile lazily on first use", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 6 });

    await accounts.ensureCreatorProfile(1);

    expect(prisma.user.create).toHaveBeenCalledWith({ data: { account_id: 1 } });
  });
});

/**
 * The welcome email.
 *
 * Deliberately not sent alongside the verification link — two emails at once is
 * noise, and "here is how DojoPay works" is worthless to someone who has not
 * finished signing up. It lands when the account first has an address it has
 * proven it controls, and exactly once, ever.
 */
describe("welcome email", () => {
  beforeEach(() => {
    sentEmails.length = 0;
    prisma.account.updateMany.mockResolvedValue({ count: 1 });
  });

  it("is not sent at email registration, only the verification link is", async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    prisma.account.create.mockResolvedValue(account({ emailVerified: false }));

    await accounts.registerWithEmail({
      email: "new@example.com",
      password: "correct-horse-battery",
    });

    expect(sentEmails.map((email) => email.subject)).toEqual(["verify"]);
  });

  it("is sent once verification completes", async () => {
    prisma.verificationToken.findUnique.mockResolvedValue({
      id: 1,
      account_id: 1,
      type: "EMAIL_VERIFICATION",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.account.findUnique.mockResolvedValue({
      email: "worker@example.com",
      displayName: "Worker",
      walletAddress: null,
    });

    await accounts.verifyEmail("token");

    expect(sentEmails).toContainEqual({ to: "worker@example.com", subject: "welcome" });
  });

  /**
   * Google has already verified the address, so there is no link to wait for.
   */
  it("is sent immediately for a new Google account", async () => {
    // Lookup by googleId, then by email, then the welcome-send re-read.
    prisma.account.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        email: "g@example.com",
        displayName: "G",
        walletAddress: null,
      });
    prisma.account.create.mockResolvedValue(account({ email: "g@example.com" }));

    await accounts.upsertGoogleAccount({ googleId: "g-1", email: "g@example.com" });

    expect(sentEmails).toContainEqual({ to: "g@example.com", subject: "welcome" });
  });

  /**
   * The claim is a conditional `updateMany`, so two concurrent verifications
   * cannot both win the race and send twice.
   */
  it("is not sent again once the claim has been taken", async () => {
    prisma.account.updateMany.mockResolvedValue({ count: 0 });
    prisma.verificationToken.findUnique.mockResolvedValue({
      id: 1,
      account_id: 1,
      type: "EMAIL_VERIFICATION",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await accounts.verifyEmail("token");

    expect(sentEmails.filter((email) => email.subject === "welcome")).toHaveLength(0);
  });

  /** A failed welcome must never fail the action that triggered it. */
  it("does not fail verification when the mail provider is down", async () => {
    const mailer = await import("../../src/lib/mailer.js");
    vi.mocked(mailer.sendWelcomeEmail).mockRejectedValueOnce(new Error("provider down"));

    prisma.verificationToken.findUnique.mockResolvedValue({
      id: 1,
      account_id: 1,
      type: "EMAIL_VERIFICATION",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.account.findUnique.mockResolvedValue({
      email: "worker@example.com",
      displayName: "Worker",
      walletAddress: null,
    });

    await expect(accounts.verifyEmail("token")).resolves.toMatchObject({
      message: "Email verified",
    });
  });
});
