import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";

vi.mock("../../src/lib/prisma.js", () => ({
  prismaClient: {
    account: { findUnique: vi.fn() },
    adminUser: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    worker: { findUnique: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  connectDB: vi.fn(),
  disconnectDB: vi.fn(),
}));

const { prismaClient } = await import("../../src/lib/prisma.js");
const { config } = await import("../../src/config/index.js");
const { requireAccount, requireAdmin, requireLinkedWallet, requireWorker } = await import(
  "../../src/middleware/auth.js"
);
const { AppError } = await import("../../src/utils/errors.js");

const prisma = prismaClient as any;

async function invoke(
  middleware: (req: Request, res: Response, next: NextFunction) => unknown,
  options: { authorization?: string; accountId?: number } = {},
) {
  const req = {
    headers: options.authorization ? { authorization: options.authorization } : {},
    accountId: options.accountId,
    socket: { remoteAddress: "127.0.0.1" },
    get: () => undefined,
  } as unknown as Request;

  const next = vi.fn();
  await middleware(req, {} as Response, next as unknown as NextFunction);

  return { req, next };
}

const accountToken = jwt.sign({ accountId: 7 }, config.auth.jwtSecret);
const adminToken = jwt.sign({ adminId: 3, mfa: true }, config.auth.adminJwtSecret);

beforeEach(() => {
  vi.clearAllMocks();
  prisma.account.findUnique.mockResolvedValue({ id: 7, status: "ACTIVE", statusReason: null });
});

describe("requireAccount", () => {
  it("accepts a valid Bearer token and attaches the account id", async () => {
    const { req, next } = await invoke(requireAccount, {
      authorization: `Bearer ${accountToken}`,
    });

    expect(next).toHaveBeenCalledWith();
    expect(req.accountId).toBe(7);
  });

  it("accepts a bare token without the Bearer prefix", async () => {
    const { req } = await invoke(requireAccount, { authorization: accountToken });
    expect(req.accountId).toBe(7);
  });

  it("rejects a missing header with 401", async () => {
    const { next } = await invoke(requireAccount);
    const error = next.mock.calls[0][0] as InstanceType<typeof AppError>;
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(401);
  });

  it("rejects a malformed token", async () => {
    const { next } = await invoke(requireAccount, { authorization: "Bearer not-a-jwt" });
    expect((next.mock.calls[0][0] as any).status).toBe(401);
  });

  it("rejects a token signed with the wrong secret", async () => {
    const forged = jwt.sign({ accountId: 7 }, "some-other-secret");
    const { next } = await invoke(requireAccount, { authorization: `Bearer ${forged}` });
    expect((next.mock.calls[0][0] as any).status).toBe(401);
  });

  /**
   * A user token must be worthless against admin routes and vice versa — the
   * two secrets are what guarantees that.
   */
  it("rejects an admin token", async () => {
    const { next } = await invoke(requireAccount, { authorization: `Bearer ${adminToken}` });
    expect((next.mock.calls[0][0] as any).status).toBe(401);
  });

  it("rejects a token carrying no accountId claim", async () => {
    const empty = jwt.sign({ somethingElse: true }, config.auth.jwtSecret);
    const { next } = await invoke(requireAccount, { authorization: `Bearer ${empty}` });
    expect((next.mock.calls[0][0] as any).status).toBe(401);
  });

  /**
   * Status is re-read per request rather than trusted from the token, so a
   * suspension takes effect immediately instead of when the token expires.
   */
  it("rejects a suspended account and explains why", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: 7,
      status: "SUSPENDED",
      statusReason: "Duplicate submissions",
    });

    const { next } = await invoke(requireAccount, { authorization: `Bearer ${accountToken}` });
    const error = next.mock.calls[0][0] as any;

    expect(error.status).toBe(403);
    expect(error.code).toBe("ACCOUNT_SUSPENDED");
    expect(error.message).toContain("Duplicate submissions");
  });

  it("rejects a banned account", async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 7, status: "BANNED", statusReason: null });

    const { next } = await invoke(requireAccount, { authorization: `Bearer ${accountToken}` });
    expect((next.mock.calls[0][0] as any).code).toBe("ACCOUNT_BANNED");
  });
});

describe("requireWorker", () => {
  it("creates the worker profile on first use", async () => {
    prisma.worker.findUnique.mockResolvedValue(null);
    prisma.worker.create.mockResolvedValue({ id: 22 });

    const { req, next } = await invoke(requireWorker, { accountId: 7 });

    expect(next).toHaveBeenCalledWith();
    expect(req.workerId).toBe(22);
    // Lazy creation is what lets signup avoid asking "creator or worker?".
    expect(prisma.worker.create).toHaveBeenCalled();
  });

  it("reuses an existing worker profile", async () => {
    prisma.worker.findUnique.mockResolvedValue({ id: 9 });

    const { req } = await invoke(requireWorker, { accountId: 7 });

    expect(req.workerId).toBe(9);
    expect(prisma.worker.create).not.toHaveBeenCalled();
  });

  it("rejects when no account is attached", async () => {
    const { next } = await invoke(requireWorker);
    expect((next.mock.calls[0][0] as any).status).toBe(401);
  });
});

describe("requireLinkedWallet", () => {
  it("allows an account with a linked wallet", async () => {
    prisma.account.findUnique.mockResolvedValue({ walletAddress: "SomeWallet111" });

    const { next } = await invoke(requireLinkedWallet, { accountId: 7 });
    expect(next).toHaveBeenCalledWith();
  });

  /** The withdrawal gate. */
  it("refuses an account with no wallet and says what to do", async () => {
    prisma.account.findUnique.mockResolvedValue({ walletAddress: null });

    const { next } = await invoke(requireLinkedWallet, { accountId: 7 });
    const error = next.mock.calls[0][0] as any;

    expect(error.status).toBe(403);
    expect(error.code).toBe("WALLET_REQUIRED");
    expect(error.message).toMatch(/connect a solana wallet/i);
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 3,
      role: "OWNER",
      email: "owner@dojopay.io",
      isActive: true,
      totpEnabled: true,
    });
  });

  it("accepts a fully authenticated admin token", async () => {
    const { req, next } = await invoke(requireAdmin, { authorization: `Bearer ${adminToken}` });

    expect(next).toHaveBeenCalledWith();
    expect(req.admin).toMatchObject({ id: 3, role: "OWNER" });
  });

  it("rejects a user token", async () => {
    const { next } = await invoke(requireAdmin, { authorization: `Bearer ${accountToken}` });
    expect((next.mock.calls[0][0] as any).status).toBe(401);
  });

  /** Passing the password step alone must not unlock the API. */
  it("rejects a token that has not completed 2FA", async () => {
    const preMfa = jwt.sign({ adminId: 3, mfa: false }, config.auth.adminJwtSecret);

    const { next } = await invoke(requireAdmin, { authorization: `Bearer ${preMfa}` });
    expect((next.mock.calls[0][0] as any).code).toBe("MFA_REQUIRED");
  });

  it("rejects an admin who has not enrolled 2FA", async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 3,
      role: "OWNER",
      email: "owner@dojopay.io",
      isActive: true,
      totpEnabled: false,
    });

    const { next } = await invoke(requireAdmin, { authorization: `Bearer ${adminToken}` });
    expect((next.mock.calls[0][0] as any).status).toBe(401);
  });
});
