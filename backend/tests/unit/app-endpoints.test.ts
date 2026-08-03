import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../../src/lib/prisma.js", () => ({
  prismaClient: {
    $queryRaw: vi.fn(),
    account: { findUnique: vi.fn() },
    adminUser: { findUnique: vi.fn() },
    task: { findUnique: vi.fn() },
    worker: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  connectDB: vi.fn(),
  disconnectDB: vi.fn(),
}));

const { prismaClient } = await import("../../src/lib/prisma.js");
const { createApp } = await import("../../src/app.js");
const { config } = await import("../../src/config/index.js");

const prisma = prismaClient as any;
const app = createApp();

const accountToken = jwt.sign({ accountId: 1 }, config.auth.jwtSecret);

/** A session token that has passed password but not the TOTP step. */
const preMfaAdminToken = jwt.sign({ adminId: 1, mfa: false }, config.auth.adminJwtSecret);
const adminToken = jwt.sign({ adminId: 1, mfa: true }, config.auth.adminJwtSecret);

beforeEach(() => {
  vi.clearAllMocks();
  prisma.account.findUnique.mockResolvedValue({ id: 1, status: "ACTIVE", statusReason: null });
  prisma.user.findUnique.mockResolvedValue({ id: 1, account_id: 1 });
});

describe("GET /health", () => {
  it("reports healthy when the database answers", async () => {
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "healthy", database: "connected" });
  });

  it("reports 503 when the database is unreachable", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("connection refused"));
    const response = await request(app).get("/health");

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ status: "unhealthy", database: "disconnected" });
  });
});

describe("authentication", () => {
  const protectedRoutes: Array<[string, string]> = [
    ["get", "/v1/user/tasks"],
    ["get", "/v1/user/dashboard"],
    ["post", "/v1/user/task"],
    ["get", "/v1/worker/nextTask"],
    ["post", "/v1/worker/submission"],
    ["post", "/v1/worker/payout"],
    ["get", "/v1/worker/earnings"],
    ["get", "/v1/auth/me"],
  ];

  it.each(protectedRoutes)("rejects unauthenticated %s %s with 401", async (method, path) => {
    const response = await (request(app) as any)[method](path);
    expect(response.status).toBe(401);
  });

  /**
   * Suspension must bite immediately, not whenever the token happens to expire —
   * which is why the account is re-read on every request rather than trusted
   * from the token's claims.
   */
  it("rejects a valid token for a suspended account", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: 1,
      status: "SUSPENDED",
      statusReason: "Spam submissions",
    });

    const response = await request(app)
      .get("/v1/user/tasks")
      .set("Authorization", `Bearer ${accountToken}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("ACCOUNT_SUSPENDED");
    expect(response.body.message).toContain("Spam submissions");
  });

  it("rejects a valid token for a banned account", async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 1, status: "BANNED", statusReason: null });

    const response = await request(app)
      .get("/v1/user/tasks")
      .set("Authorization", `Bearer ${accountToken}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("ACCOUNT_BANNED");
  });

  it("rejects a token whose account no longer exists", async () => {
    prisma.account.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .get("/v1/user/tasks")
      .set("Authorization", `Bearer ${accountToken}`);

    expect(response.status).toBe(401);
  });

  /** The removed debug endpoint returned worker 1's full ledger with no auth. */
  it("no longer exposes the unauthenticated test-earnings endpoint", async () => {
    const response = await request(app).get("/v1/worker/test-earnings");
    expect(response.status).toBe(401);
    expect(response.body.pendingEarnings).toBeUndefined();
  });
});

describe("admin API isolation", () => {
  const adminRoutes = [
    "/v1/admin/overview",
    "/v1/admin/accounts",
    "/v1/admin/audit",
    "/v1/admin/tasks",
  ];

  it.each(adminRoutes)("rejects unauthenticated %s", async (path) => {
    const response = await request(app).get(path);
    expect(response.status).toBe(401);
  });

  /**
   * The whole point of a separate secret: even a perfectly valid user session
   * must be worthless against the admin API.
   */
  it.each(adminRoutes)("rejects a valid user token on %s", async (path) => {
    const response = await request(app).get(path).set("Authorization", `Bearer ${accountToken}`);
    expect(response.status).toBe(401);
  });

  /** Password alone is not a session — the TOTP step must have happened. */
  it("rejects an admin token that has not completed 2FA", async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 1,
      role: "OWNER",
      email: "a@b.com",
      isActive: true,
      totpEnabled: true,
    });

    const response = await request(app)
      .get("/v1/admin/overview")
      .set("Authorization", `Bearer ${preMfaAdminToken}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("MFA_REQUIRED");
  });

  it("rejects an admin who has not enrolled 2FA", async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 1,
      role: "OWNER",
      email: "a@b.com",
      isActive: true,
      totpEnabled: false,
    });

    const response = await request(app)
      .get("/v1/admin/overview")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(401);
  });

  it("rejects a deactivated admin", async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 1,
      role: "OWNER",
      email: "a@b.com",
      isActive: false,
      totpEnabled: true,
    });

    const response = await request(app)
      .get("/v1/admin/overview")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(401);
  });

  /** ANALYST is read-only: moderation is not theirs to do. */
  it("refuses moderation from an ANALYST", async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 1,
      role: "ANALYST",
      email: "a@b.com",
      isActive: true,
      totpEnabled: true,
    });

    const response = await request(app)
      .post("/v1/admin/accounts/2/moderate")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "SUSPEND", reason: "Testing role enforcement" });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("INSUFFICIENT_ROLE");
  });

  /**
   * Admins exist only via the `admin:create` CLI. No HTTP path may create one —
   * these either 404 or are swallowed by the auth guard, but must never succeed.
   */
  it("has no admin self-registration route", async () => {
    for (const path of ["/v1/admin/register", "/v1/admin/auth/register", "/v1/admin/signup"]) {
      const response = await request(app).post(path).send({
        email: "attacker@example.com",
        password: "a-perfectly-fine-passphrase",
        displayName: "Attacker",
        role: "OWNER",
      });
      expect([401, 403, 404]).toContain(response.status);
    }
  });
});

describe("validation", () => {
  it("returns 400 with field-level issues for a malformed body", async () => {
    const response = await request(app)
      .post("/v1/user/task")
      .set("Authorization", `Bearer ${accountToken}`)
      .send({ options: [], signature: "" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(response.body.issues)).toBe(true);
  });

  it("requires at least two options on a task", async () => {
    const response = await request(app)
      .post("/v1/user/task")
      .set("Authorization", `Bearer ${accountToken}`)
      .send({ options: [{ imageUrl: "a.jpg" }], signature: "sig" });

    expect(response.status).toBe(400);
  });

  it("rejects a weak password at registration", async () => {
    const response = await request(app)
      .post("/v1/auth/register")
      .send({ email: "someone@example.com", password: "password" });

    expect(response.status).toBe(400);
  });

  it("rejects a malformed email at registration", async () => {
    const response = await request(app)
      .post("/v1/auth/register")
      .send({ email: "not-an-email", password: "a-perfectly-fine-passphrase" });

    expect(response.status).toBe(400);
  });
});

describe("public share endpoint", () => {
  it("serves a task preview with no authentication", async () => {
    prisma.task.findUnique.mockResolvedValue({
      id: 1,
      title: "Pick the best logo",
      amount: 100_000_000n,
      rewardPerSubmission: 1_000_000n,
      maxSubmissions: 100,
      status: "OPEN",
      submissionCount: 10,
      expiresAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      options: [{ image_url: "https://cdn/a.jpg" }],
    });

    const response = await request(app).get("/v1/public/task/1");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      title: "Pick the best logo",
      rewardLamports: "1000000",
      spotsRemaining: 90,
    });
  });

  it("404s for an unknown task", async () => {
    prisma.task.findUnique.mockResolvedValue(null);
    const response = await request(app).get("/v1/public/task/999");
    expect(response.status).toBe(404);
  });

  it("rejects a non-numeric task id", async () => {
    const response = await request(app).get("/v1/public/task/abc");
    expect(response.status).toBe(400);
  });
});

describe("unmatched routes", () => {
  it("returns a structured 404", async () => {
    const response = await request(app).get("/v1/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body.code).toBe("ROUTE_NOT_FOUND");
  });
});
