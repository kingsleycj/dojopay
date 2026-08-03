import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../../src/lib/prisma.js", () => ({
  prismaClient: {
    $queryRaw: vi.fn(),
    task: { findUnique: vi.fn() },
    worker: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
  connectDB: vi.fn(),
  disconnectDB: vi.fn(),
}));

const { prismaClient } = await import("../../src/lib/prisma.js");
const { createApp } = await import("../../src/app.js");
const { config } = await import("../../src/config/index.js");

const prisma = prismaClient as any;
const app = createApp();

beforeEach(() => {
  vi.clearAllMocks();
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
  ];

  it.each(protectedRoutes)("rejects unauthenticated %s %s with 401", async (method, path) => {
    const response = await (request(app) as any)[method](path);
    expect(response.status).toBe(401);
  });

  it("rejects a creator token on a worker route", async () => {
    const creatorToken = jwt.sign({ userId: 1 }, config.auth.jwtSecret);

    const response = await request(app)
      .get("/v1/worker/nextTask")
      .set("Authorization", `Bearer ${creatorToken}`);

    expect(response.status).toBe(401);
  });

  /**
   * The removed debug endpoint returned worker 1's full ledger with no auth.
   */
  it("no longer exposes the unauthenticated test-earnings endpoint", async () => {
    const response = await request(app).get("/v1/worker/test-earnings");
    expect(response.status).toBe(401);
    expect(response.body.pendingEarnings).toBeUndefined();
  });
});

describe("validation", () => {
  it("returns 400 with field-level issues for a malformed body", async () => {
    const token = jwt.sign({ userId: 1 }, config.auth.jwtSecret);

    const response = await request(app)
      .post("/v1/user/task")
      .set("Authorization", `Bearer ${token}`)
      .send({ options: [], signature: "" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(response.body.issues)).toBe(true);
  });

  it("requires at least two options on a task", async () => {
    const token = jwt.sign({ userId: 1 }, config.auth.jwtSecret);

    const response = await request(app)
      .post("/v1/user/task")
      .set("Authorization", `Bearer ${token}`)
      .send({ options: [{ imageUrl: "a.jpg" }], signature: "sig" });

    expect(response.status).toBe(400);
  });
});

describe("public share endpoint", () => {
  it("serves a task preview with no authentication", async () => {
    prisma.task.findUnique.mockResolvedValue({
      id: 1,
      title: "Pick the best logo",
      amount: 100_000_000n,
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
