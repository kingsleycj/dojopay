import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/prisma.js", () => ({
  prismaClient: {
    task: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
    submission: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    worker: { update: vi.fn(), findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    payouts: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  connectDB: vi.fn(),
  disconnectDB: vi.fn(),
}));

const { prismaClient } = await import("../../src/lib/prisma.js");
const { getNextTask, submitTask } = await import("../../src/services/worker.service.js");
const { MAX_SUBMISSIONS_PER_TASK } = await import("../../src/config/index.js");

const prisma = prismaClient as any;

function openTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: "Pick one",
    amount: 100_000_000n,
    status: "OPEN",
    submissionCount: 0,
    expiresAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    options: [{ id: 10 }, { id: 11 }],
    ...overrides,
  };
}

/** Runs the callback against a transaction client backed by the same mocks. */
function passthroughTransaction() {
  prisma.$transaction.mockImplementation(async (fn: any) =>
    fn({
      task: prisma.task,
      submission: prisma.submission,
      worker: prisma.worker,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getNextTask", () => {
  it("excludes full tasks, expired tasks and tasks the worker already answered", async () => {
    prisma.task.findFirst.mockResolvedValue(null);
    await getNextTask(5);

    const where = prisma.task.findFirst.mock.calls[0][0].where;

    expect(where.status).toBe("OPEN");
    // The capacity clause is what stops a task paying out more than it was funded for.
    expect(where.submissionCount).toEqual({ lt: MAX_SUBMISSIONS_PER_TASK });
    expect(where.submissions).toEqual({ none: { worker_id: 5 } });
    expect(where.OR).toEqual([{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }]);
  });

  it("returns null when nothing is available", async () => {
    prisma.task.findFirst.mockResolvedValue(null);
    expect(await getNextTask(5)).toBeNull();
  });

  it("reports the per-submission reward, not the whole task amount", async () => {
    prisma.task.findFirst.mockResolvedValue(openTask({ options: [{ id: 10, image_url: "a.jpg" }] }));

    const task = await getNextTask(5);

    expect(task?.amount).toBe("100000000");
    expect(task?.rewardLamports).toBe("1000000"); // 0.1 SOL / 100
  });
});

describe("submitTask", () => {
  it("credits exactly amount / MAX_SUBMISSIONS_PER_TASK", async () => {
    prisma.task.findUnique.mockResolvedValue(openTask());
    prisma.task.updateMany.mockResolvedValue({ count: 1 });
    prisma.task.findUniqueOrThrow.mockResolvedValue({ submissionCount: 1 });
    prisma.submission.create.mockResolvedValue({ id: 100 });
    passthroughTransaction();

    const result = await submitTask(5, 1, 10);

    expect(result.reward).toBe(1_000_000n);
    expect(prisma.worker.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { pending_amount: { increment: 1_000_000n } },
    });
  });

  it("refuses a task that is already at capacity", async () => {
    prisma.task.findUnique.mockResolvedValue(
      openTask({ submissionCount: MAX_SUBMISSIONS_PER_TASK }),
    );

    await expect(submitTask(5, 1, 10)).rejects.toMatchObject({ code: "TASK_FULL" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  /**
   * Two workers racing for the final slot. The conditional updateMany matches
   * zero rows for the loser, so only one submission is ever credited.
   */
  it("loses the race safely when another worker takes the last slot first", async () => {
    prisma.task.findUnique.mockResolvedValue(
      openTask({ submissionCount: MAX_SUBMISSIONS_PER_TASK - 1 }),
    );
    prisma.task.updateMany.mockResolvedValue({ count: 0 });
    passthroughTransaction();

    await expect(submitTask(5, 1, 10)).rejects.toMatchObject({ code: "TASK_FULL" });
    expect(prisma.submission.create).not.toHaveBeenCalled();
    expect(prisma.worker.update).not.toHaveBeenCalled();
  });

  it("closes the task once the final slot is taken", async () => {
    prisma.task.findUnique.mockResolvedValue(
      openTask({ submissionCount: MAX_SUBMISSIONS_PER_TASK - 1 }),
    );
    prisma.task.updateMany.mockResolvedValue({ count: 1 });
    prisma.task.findUniqueOrThrow.mockResolvedValue({ submissionCount: MAX_SUBMISSIONS_PER_TASK });
    prisma.submission.create.mockResolvedValue({ id: 101 });
    passthroughTransaction();

    const result = await submitTask(5, 1, 10);

    expect(result.taskFull).toBe(true);
    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "COMPLETED", done: true },
    });
  });

  it("leaves the task open while slots remain", async () => {
    prisma.task.findUnique.mockResolvedValue(openTask({ submissionCount: 3 }));
    prisma.task.updateMany.mockResolvedValue({ count: 1 });
    prisma.task.findUniqueOrThrow.mockResolvedValue({ submissionCount: 4 });
    prisma.submission.create.mockResolvedValue({ id: 102 });
    passthroughTransaction();

    const result = await submitTask(5, 1, 10);

    expect(result.taskFull).toBe(false);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it("rejects an option belonging to a different task", async () => {
    prisma.task.findUnique.mockResolvedValue(openTask());
    await expect(submitTask(5, 1, 999)).rejects.toMatchObject({ code: "INVALID_OPTION" });
  });

  it("rejects an expired task", async () => {
    prisma.task.findUnique.mockResolvedValue(
      openTask({ expiresAt: new Date(Date.now() - 60_000) }),
    );
    await expect(submitTask(5, 1, 10)).rejects.toMatchObject({ code: "TASK_EXPIRED" });
  });

  it("rejects a completed task", async () => {
    prisma.task.findUnique.mockResolvedValue(openTask({ status: "COMPLETED" }));
    await expect(submitTask(5, 1, 10)).rejects.toMatchObject({ code: "TASK_CLOSED" });
  });

  it("rejects a missing task", async () => {
    prisma.task.findUnique.mockResolvedValue(null);
    await expect(submitTask(5, 1, 10)).rejects.toMatchObject({ code: "TASK_NOT_FOUND" });
  });

  it("translates the unique-constraint violation into a duplicate error", async () => {
    const { Prisma } = await import("@prisma/client");
    prisma.task.findUnique.mockResolvedValue(openTask());
    prisma.task.updateMany.mockResolvedValue({ count: 1 });
    prisma.submission.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "5.19.1",
      }),
    );
    passthroughTransaction();

    await expect(submitTask(5, 1, 10)).rejects.toMatchObject({ code: "DUPLICATE_SUBMISSION" });
  });
});
