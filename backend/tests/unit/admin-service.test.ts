import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/prisma.js", () => ({
  prismaClient: {
    adminUser: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    account: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    task: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    submission: { count: vi.fn(), findMany: vi.fn() },
    payouts: { aggregate: vi.fn(), count: vi.fn() },
    worker: { aggregate: vi.fn() },
  },
  connectDB: vi.fn(),
  disconnectDB: vi.fn(),
}));

// Async stubs, not bare `vi.fn()`: the service chains `.catch()` on the send so
// a failed email cannot block a suspension, and a stub returning `undefined`
// would blow up on that chain.
vi.mock("../../src/lib/mailer.js", () => ({
  sendAccountSuspendedEmail: vi.fn(async () => {}),
  sendVerificationEmail: vi.fn(async () => {}),
  sendPasswordResetEmail: vi.fn(async () => {}),
  getMailer: vi.fn(),
}));

const { prismaClient } = await import("../../src/lib/prisma.js");
const admin = await import("../../src/services/admin.service.js");
const { sendAccountSuspendedEmail } = await import("../../src/lib/mailer.js");
const { hashPassword } = await import("../../src/lib/password.js");

const prisma = prismaClient as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("adminLoginStep1", () => {
  /** Password alone never yields a usable session. */
  it("returns a 2FA challenge, not a session, for an enrolled admin", async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 1,
      email: "owner@dojopay.io",
      passwordHash: await hashPassword("a-good-admin-passphrase"),
      isActive: true,
      totpEnabled: true,
      totpSecret: "SECRET",
    });

    const result = await admin.adminLoginStep1({
      email: "owner@dojopay.io",
      password: "a-good-admin-passphrase",
    });

    expect(result.stage).toBe("VERIFY_2FA");
    expect(result).toHaveProperty("challengeToken");
    // Crucially not a session token.
    expect(result).not.toHaveProperty("token");
  });

  /** 2FA is mandatory: an unenrolled admin is forced through setup first. */
  it("forces enrolment on first login and returns a QR code", async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 1,
      email: "owner@dojopay.io",
      passwordHash: await hashPassword("a-good-admin-passphrase"),
      isActive: true,
      totpEnabled: false,
      totpSecret: null,
    });
    prisma.adminUser.update.mockResolvedValue({});

    const result = await admin.adminLoginStep1({
      email: "owner@dojopay.io",
      password: "a-good-admin-passphrase",
    });

    expect(result.stage).toBe("ENROLL_2FA");
    expect(result).not.toHaveProperty("token");
    expect((result as any).qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("rejects a wrong password", async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 1,
      email: "owner@dojopay.io",
      passwordHash: await hashPassword("a-good-admin-passphrase"),
      isActive: true,
      totpEnabled: true,
      totpSecret: "SECRET",
    });

    await expect(
      admin.adminLoginStep1({ email: "owner@dojopay.io", password: "wrong" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("rejects a deactivated admin", async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 1,
      email: "owner@dojopay.io",
      passwordHash: await hashPassword("a-good-admin-passphrase"),
      isActive: false,
      totpEnabled: true,
      totpSecret: "SECRET",
    });

    await expect(
      admin.adminLoginStep1({
        email: "owner@dojopay.io",
        password: "a-good-admin-passphrase",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  /** Same message and shape whether or not the admin exists. */
  it("does not reveal whether an admin email exists", async () => {
    prisma.adminUser.findUnique.mockResolvedValue(null);

    await expect(
      admin.adminLoginStep1({ email: "nobody@dojopay.io", password: "whatever" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
});

describe("adminLoginStep2", () => {
  it("rejects a challenge token that was issued for enrolment", async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 1,
      email: "owner@dojopay.io",
      passwordHash: await hashPassword("a-good-admin-passphrase"),
      isActive: true,
      totpEnabled: false,
      totpSecret: null,
    });
    prisma.adminUser.update.mockResolvedValue({});

    const enrolChallenge = await admin.adminLoginStep1({
      email: "owner@dojopay.io",
      password: "a-good-admin-passphrase",
    });

    // An enrolment challenge must not be swappable for a verification one.
    await expect(
      admin.adminLoginStep2({ challengeToken: enrolChallenge.challengeToken, code: "123456" }),
    ).rejects.toMatchObject({ code: "CHALLENGE_EXPIRED" });
  });

  it("rejects a forged challenge token", async () => {
    await expect(
      admin.adminLoginStep2({ challengeToken: "not-a-jwt", code: "123456" }),
    ).rejects.toMatchObject({ code: "CHALLENGE_EXPIRED" });
  });
});

describe("moderateAccount", () => {
  const target = {
    id: 42,
    email: "worker@example.com",
    status: "ACTIVE",
    workerProfile: { pending_amount: 3_000_000n },
  };

  it("suspends an account, records the reason, and emails the user", async () => {
    prisma.account.findUnique.mockResolvedValue(target);
    prisma.account.update.mockResolvedValue({
      id: 42,
      status: "SUSPENDED",
      statusReason: "Duplicate submissions",
    });

    const result = await admin.moderateAccount({
      accountId: 42,
      adminId: 1,
      action: "SUSPEND",
      reason: "Duplicate submissions",
    });

    expect(result.status).toBe("SUSPENDED");
    expect(sendAccountSuspendedEmail).toHaveBeenCalledWith(
      "worker@example.com",
      "Duplicate submissions",
    );
  });

  /** Every moderation action names the admin who took it. */
  it("writes an audit entry attributed to the acting admin", async () => {
    prisma.account.findUnique.mockResolvedValue(target);
    prisma.account.update.mockResolvedValue({ id: 42, status: "SUSPENDED", statusReason: "x" });

    await admin.moderateAccount({
      accountId: 42,
      adminId: 7,
      action: "SUSPEND",
      reason: "Duplicate submissions",
    });

    const entry = prisma.auditLog.create.mock.calls[0][0].data;
    expect(entry.actorAdminId).toBe(7);
    expect(entry.action).toBe("ADMIN_ACCOUNT_SUSPENDED");
    expect(entry.entityId).toBe("42");
    expect(entry.severity).toBe("CRITICAL");
  });

  /**
   * Banning someone who is owed money needs a human decision about how they get
   * paid, so the outstanding balance is surfaced in the record.
   */
  it("records any outstanding balance at the moment of suspension", async () => {
    prisma.account.findUnique.mockResolvedValue(target);
    prisma.account.update.mockResolvedValue({ id: 42, status: "BANNED", statusReason: "x" });

    await admin.moderateAccount({
      accountId: 42,
      adminId: 1,
      action: "BAN",
      reason: "Fraudulent submissions",
    });

    const entry = prisma.auditLog.create.mock.calls[0][0].data;
    expect(entry.metadata.outstandingBalance).toBe("3000000");
  });

  it("does not email on reactivation", async () => {
    prisma.account.findUnique.mockResolvedValue({ ...target, status: "SUSPENDED" });
    prisma.account.update.mockResolvedValue({ id: 42, status: "ACTIVE", statusReason: null });

    await admin.moderateAccount({
      accountId: 42,
      adminId: 1,
      action: "REACTIVATE",
      reason: "Appeal upheld",
    });

    expect(sendAccountSuspendedEmail).not.toHaveBeenCalled();
  });

  it("refuses a no-op transition", async () => {
    prisma.account.findUnique.mockResolvedValue({ ...target, status: "SUSPENDED" });

    await expect(
      admin.moderateAccount({
        accountId: 42,
        adminId: 1,
        action: "SUSPEND",
        reason: "Already suspended",
      }),
    ).rejects.toMatchObject({ code: "NO_CHANGE" });
  });

  it("rejects an unknown account", async () => {
    prisma.account.findUnique.mockResolvedValue(null);

    await expect(
      admin.moderateAccount({ accountId: 999, adminId: 1, action: "SUSPEND", reason: "Testing" }),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
  });
});

describe("forceCloseTask", () => {
  it("closes an open task and records the reason", async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 5, status: "OPEN", submissionCount: 12, user_id: 3 });
    prisma.task.update.mockResolvedValue({ id: 5, status: "FORCE_CLOSED" });

    const result = await admin.forceCloseTask({
      taskId: 5,
      adminId: 1,
      reason: "Images violate content policy",
    });

    expect(result.status).toBe("FORCE_CLOSED");
    expect(prisma.task.update.mock.calls[0][0].data.moderationReason).toBe(
      "Images violate content policy",
    );
  });

  /**
   * Moderation must not silently move money: workers who already submitted keep
   * what they earned, and refunding the creator is a separate decision.
   */
  it("does not touch balances", async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 5, status: "OPEN", submissionCount: 12, user_id: 3 });
    prisma.task.update.mockResolvedValue({ id: 5, status: "FORCE_CLOSED" });

    await admin.forceCloseTask({ taskId: 5, adminId: 1, reason: "Policy violation" });

    const updated = prisma.task.update.mock.calls[0][0].data;
    expect(updated).not.toHaveProperty("amount");
    expect(updated).not.toHaveProperty("submissionCount");
  });

  it("refuses to close a task that is not open", async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 5, status: "COMPLETED", submissionCount: 100 });

    await expect(
      admin.forceCloseTask({ taskId: 5, adminId: 1, reason: "Too late" }),
    ).rejects.toMatchObject({ code: "TASK_NOT_OPEN" });
  });
});

describe("getAccountDetail", () => {
  /** Staff access to a user's record is itself reviewable. */
  it("audits the fact that an admin viewed the account", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: 42,
      email: "worker@example.com",
      passwordHash: "$argon2id$secret",
      googleId: "google-123",
      creatorProfile: null,
      workerProfile: null,
    });

    await admin.getAccountDetail(42, 7);

    const entry = prisma.auditLog.create.mock.calls[0][0].data;
    expect(entry.action).toBe("ADMIN_VIEWED_ACCOUNT");
    expect(entry.actorAdminId).toBe(7);
  });

  /** Even admins never see credential material. */
  it("strips the password hash and Google id", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: 42,
      email: "worker@example.com",
      passwordHash: "$argon2id$secret",
      googleId: "google-123",
      creatorProfile: null,
      workerProfile: null,
    });

    const detail = await admin.getAccountDetail(42, 7);

    expect(detail).not.toHaveProperty("passwordHash");
    expect(detail).not.toHaveProperty("googleId");
    expect(detail.hasPassword).toBe(true);
    expect(detail.hasGoogle).toBe(true);
  });
});
