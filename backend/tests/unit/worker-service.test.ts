import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/prisma.js", () => ({
  prismaClient: {
    task: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    submission: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    worker: { update: vi.fn(), findUnique: vi.fn() },
    vault: { update: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    vaultEntry: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    payouts: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  connectDB: vi.fn(),
  disconnectDB: vi.fn(),
}));

const { prismaClient } = await import("../../src/lib/prisma.js");
const { getNextTask, listAvailableTasks, submitTask } = await import(
  "../../src/services/worker.service.js"
);

const prisma = prismaClient as any;

const CREATOR_VAULT_ID = 77;

/**
 * A vault-funded task: 100 slots at 0.001 SOL, budget 0.1 SOL.
 *
 * The reward is now a stored column rather than `amount / a global constant`,
 * so tests set it explicitly — which is the point: two tasks with identical
 * budgets can legitimately pay different amounts.
 */
function openTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: "Pick one",
    amount: 100_000_000n,
    rewardPerSubmission: 1_000_000n,
    maxSubmissions: 100,
    vaultFunded: true,
    status: "OPEN",
    submissionCount: 0,
    expiresAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    options: [{ id: 10 }, { id: 11 }],
    user: { account: { id: 9, vault: { id: CREATOR_VAULT_ID } } },
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
      vault: prisma.vault,
      vaultEntry: prisma.vaultEntry,
    }),
  );
}

/** The vault leg of a submission needs a row to update and one to read back. */
function stubVault(available = 0n, reserved = 100_000_000n) {
  prisma.vault.update.mockResolvedValue({ id: CREATOR_VAULT_ID, available, reserved });
  prisma.vaultEntry.create.mockResolvedValue({ id: 1 });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getNextTask", () => {
  it("excludes expired tasks and tasks the worker already answered", async () => {
    prisma.task.findMany.mockResolvedValue([]);
    await getNextTask(5);

    const where = prisma.task.findMany.mock.calls[0][0].where;

    expect(where.status).toBe("OPEN");
    expect(where.submissions).toEqual({ none: { worker_id: 5 } });
    expect(where.OR).toEqual([{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }]);
  });

  it("returns null when nothing is available", async () => {
    prisma.task.findMany.mockResolvedValue([]);
    expect(await getNextTask(5)).toBeNull();
  });

  /**
   * The capacity bound compares two columns, which Prisma cannot express as a
   * filter, so it is applied after the read. A full task reaching the caller
   * would be the drain bug returning.
   */
  it("skips a task that is already at capacity", async () => {
    prisma.task.findMany.mockResolvedValue([
      openTask({ id: 1, submissionCount: 100, maxSubmissions: 100, options: [] }),
      openTask({ id: 2, submissionCount: 4, maxSubmissions: 10, options: [] }),
    ]);

    const task = await getNextTask(5);
    expect(task?.id).toBe(2);
  });

  it("reports the per-submission reward, not the whole task amount", async () => {
    prisma.task.findMany.mockResolvedValue([
      openTask({ options: [{ id: 10, image_url: "a.jpg" }] }),
    ]);

    const task = await getNextTask(5);

    expect(task?.amount).toBe("100000000");
    expect(task?.rewardLamports).toBe("1000000");
    expect(task?.spotsRemaining).toBe(100);
  });

  /** Two tasks with the same budget can pay differently — that is the feature. */
  it("reports each task's own reward rather than a global rate", async () => {
    prisma.task.findMany.mockResolvedValue([
      openTask({ rewardPerSubmission: 20_000_000n, maxSubmissions: 5, options: [] }),
    ]);

    const task = await getNextTask(5);
    expect(task?.rewardLamports).toBe("20000000");
  });
});

describe("listAvailableTasks", () => {
  it("orders by reward so the best-paying work surfaces first", async () => {
    prisma.task.findMany.mockResolvedValue([]);
    await listAvailableTasks(5);

    const orderBy = prisma.task.findMany.mock.calls[0][0].orderBy;
    expect(orderBy[0]).toEqual({ rewardPerSubmission: "desc" });
  });

  it("drops tasks at capacity", async () => {
    prisma.task.findMany.mockResolvedValue([
      openTask({ id: 1, submissionCount: 10, maxSubmissions: 10, options: [] }),
      openTask({ id: 2, submissionCount: 0, maxSubmissions: 10, options: [] }),
    ]);

    const tasks = await listAvailableTasks(5);
    expect(tasks.map((task) => task.id)).toEqual([2]);
  });
});

describe("submitTask", () => {
  it("credits the task's own reward, not a global rate", async () => {
    prisma.task.findUnique.mockResolvedValue(
      openTask({ rewardPerSubmission: 5_000_000n, maxSubmissions: 20, amount: 100_000_000n }),
    );
    prisma.task.updateMany.mockResolvedValue({ count: 1 });
    prisma.task.findUniqueOrThrow.mockResolvedValue({ submissionCount: 1 });
    prisma.submission.create.mockResolvedValue({ id: 100 });
    stubVault();
    passthroughTransaction();

    const result = await submitTask(5, 1, 10);

    expect(result.reward).toBe(5_000_000n);
    expect(prisma.worker.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { pending_amount: { increment: 5_000_000n } },
    });
  });

  /**
   * The whole point of the vault: crediting a worker and drawing down the
   * creator's reservation are one atomic event, so the two cannot drift apart.
   */
  it("releases the reward from the creator's vault reservation", async () => {
    prisma.task.findUnique.mockResolvedValue(openTask());
    prisma.task.updateMany.mockResolvedValue({ count: 1 });
    prisma.task.findUniqueOrThrow.mockResolvedValue({ submissionCount: 1 });
    prisma.submission.create.mockResolvedValue({ id: 100 });
    stubVault();
    passthroughTransaction();

    await submitTask(5, 1, 10);

    expect(prisma.vault.update).toHaveBeenCalledWith({
      where: { id: CREATOR_VAULT_ID },
      data: {
        reserved: { increment: -1_000_000n },
        totalSpent: { increment: 1_000_000n },
      },
    });
    expect(prisma.vaultEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "REWARD_RELEASED", amount: 1_000_000n }),
      }),
    );
  });

  /**
   * Tasks created before vaults existed have no reservation. Inventing one would
   * drive a creator's balance negative, so the ledger leg is skipped.
   */
  it("skips the vault leg for a task created before vaults existed", async () => {
    prisma.task.findUnique.mockResolvedValue(
      openTask({ vaultFunded: false, user: { account: { id: 9, vault: null } } }),
    );
    prisma.task.updateMany.mockResolvedValue({ count: 1 });
    prisma.task.findUniqueOrThrow.mockResolvedValue({ submissionCount: 1 });
    prisma.submission.create.mockResolvedValue({ id: 100 });
    passthroughTransaction();

    await submitTask(5, 1, 10);

    expect(prisma.vault.update).not.toHaveBeenCalled();
    // The worker is still paid — their work is owed regardless.
    expect(prisma.worker.update).toHaveBeenCalled();
  });

  it("refuses a task that is already at capacity", async () => {
    prisma.task.findUnique.mockResolvedValue(openTask({ submissionCount: 100 }));

    await expect(submitTask(5, 1, 10)).rejects.toMatchObject({ code: "TASK_FULL" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("respects a task's own capacity rather than a global cap", async () => {
    prisma.task.findUnique.mockResolvedValue(
      openTask({ maxSubmissions: 5, submissionCount: 5 }),
    );

    await expect(submitTask(5, 1, 10)).rejects.toMatchObject({ code: "TASK_FULL" });
  });

  /**
   * Two workers racing for the final slot. The conditional updateMany matches
   * zero rows for the loser, so only one submission is ever credited.
   */
  it("loses the race safely when another worker takes the last slot first", async () => {
    prisma.task.findUnique.mockResolvedValue(openTask({ submissionCount: 99 }));
    prisma.task.updateMany.mockResolvedValue({ count: 0 });
    passthroughTransaction();

    await expect(submitTask(5, 1, 10)).rejects.toMatchObject({ code: "TASK_FULL" });
    expect(prisma.submission.create).not.toHaveBeenCalled();
    expect(prisma.worker.update).not.toHaveBeenCalled();
    expect(prisma.vault.update).not.toHaveBeenCalled();
  });

  it("closes the task once the final slot is taken", async () => {
    prisma.task.findUnique.mockResolvedValue(openTask({ submissionCount: 99 }));
    prisma.task.updateMany.mockResolvedValue({ count: 1 });
    prisma.task.findUniqueOrThrow.mockResolvedValue({ submissionCount: 100 });
    prisma.submission.create.mockResolvedValue({ id: 101 });
    stubVault();
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
    stubVault();
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
