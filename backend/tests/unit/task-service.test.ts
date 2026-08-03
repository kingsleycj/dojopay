import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/prisma.js", () => ({
  prismaClient: {
    task: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    submission: { findMany: vi.fn() },
    vault: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    vaultEntry: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  connectDB: vi.fn(),
  disconnectDB: vi.fn(),
}));

const { prismaClient } = await import("../../src/lib/prisma.js");
const { cancelTask, createTask, effectiveStatus, getPublicTask, planBudget, quoteBudget } =
  await import("../../src/services/task.service.js");
const {
  MIN_REWARD_PER_SUBMISSION_LAMPORTS,
  MIN_TASK_BUDGET_LAMPORTS,
  MAX_SUBMISSIONS_PER_TASK,
} = await import("../../src/config/index.js");

const prisma = prismaClient as any;

const VAULT_ID = 77;

/** Every field `serializeVault` reads, so a partial mock cannot mask a bug. */
function vaultRow(overrides: Record<string, unknown> = {}) {
  return {
    id: VAULT_ID,
    account_id: 10,
    available: 10_000_000_000n,
    reserved: 0n,
    totalDeposited: 10_000_000_000n,
    totalWithdrawn: 0n,
    totalSpent: 0n,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

/** Runs the callback against a transaction client backed by the same mocks. */
function passthroughTransaction() {
  prisma.$transaction.mockImplementation(async (fn: any) =>
    fn({
      task: prisma.task,
      user: prisma.user,
      vault: prisma.vault,
      vaultEntry: prisma.vaultEntry,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.task.findUnique.mockResolvedValue(null);
  prisma.vault.findUnique.mockResolvedValue(vaultRow());
});

/**
 * Budget arithmetic.
 *
 * This is the rule the whole economics rests on: a task must never be able to
 * promise more than it reserves, in either direction.
 */
describe("planBudget", () => {
  it("splits a divisible budget exactly", () => {
    const plan = planBudget(100_000_000n, 100);

    expect(plan.rewardPerSubmission).toBe(1_000_000n);
    expect(plan.committed).toBe(100_000_000n);
    expect(plan.remainder).toBe(0n);
  });

  /**
   * The invariant that makes refunds a subtraction rather than a
   * reconciliation: what is reserved is exactly what workers can still claim.
   */
  it("never reserves more than the slots can pay out", () => {
    for (const [budget, slots] of [
      [100_000_000n, 30],
      [333_333_333n, 7],
      [10_000_000n, 9],
      [999_999_999n, 999],
    ] as Array<[bigint, number]>) {
      const plan = planBudget(budget, slots);
      expect(plan.rewardPerSubmission * BigInt(slots)).toBe(plan.committed);
      expect(plan.committed).toBeLessThanOrEqual(budget);
      expect(plan.remainder).toBeLessThan(BigInt(slots));
    }
  });

  it("leaves the indivisible remainder in the vault rather than stranding it", () => {
    const plan = planBudget(100_000_000n, 30);

    expect(plan.rewardPerSubmission).toBe(3_333_333n);
    expect(plan.committed).toBe(99_999_990n);
    expect(plan.remainder).toBe(10n);
  });

  it("rejects a budget below the floor", () => {
    expect(() => planBudget(MIN_TASK_BUDGET_LAMPORTS - 1n, 10)).toThrowError(
      expect.objectContaining({ code: "BUDGET_TOO_SMALL" }),
    );
  });

  /** Guards the other end: a legal budget spread so thin each answer pays dust. */
  it("rejects a reward below the per-submission floor", () => {
    expect(() => planBudget(MIN_TASK_BUDGET_LAMPORTS, MAX_SUBMISSIONS_PER_TASK)).toThrowError(
      expect.objectContaining({ code: "REWARD_TOO_SMALL" }),
    );
  });

  it("rejects a slot count outside the permitted range", () => {
    expect(() => planBudget(100_000_000n, 1)).toThrowError(
      expect.objectContaining({ code: "INVALID_SUBMISSION_COUNT" }),
    );
    expect(() => planBudget(100_000_000_000n, MAX_SUBMISSIONS_PER_TASK + 1)).toThrowError(
      expect.objectContaining({ code: "INVALID_SUBMISSION_COUNT" }),
    );
  });

  it("accepts a reward exactly at the floor", () => {
    const slots = 10;
    const plan = planBudget(MIN_REWARD_PER_SUBMISSION_LAMPORTS * BigInt(slots) * 10n, slots);
    expect(plan.rewardPerSubmission).toBeGreaterThanOrEqual(MIN_REWARD_PER_SUBMISSION_LAMPORTS);
  });
});

describe("quoteBudget", () => {
  /**
   * The composer renders these strings directly, so a quote that disagreed with
   * what `createTask` reserves would show a creator one reward and pay another.
   */
  it("returns the same arithmetic the creation path uses, as strings", () => {
    const quote = quoteBudget(100_000_000n, 30);
    const plan = planBudget(100_000_000n, 30);

    expect(quote.rewardPerSubmission).toBe(plan.rewardPerSubmission.toString());
    expect(quote.committed).toBe(plan.committed.toString());
    expect(quote.remainder).toBe(plan.remainder.toString());
  });
});

describe("createTask", () => {
  function creatorExists() {
    prisma.user.findUnique.mockResolvedValue({ id: 1, account_id: 10 });
  }

  it("rejects an expiry in the past before reserving anything", async () => {
    creatorExists();

    await expect(
      createTask(1, {
        options: [{ imageUrl: "a.jpg" }, { imageUrl: "b.jpg" }],
        budgetLamports: "100000000",
        maxSubmissions: 100,
        expirationDate: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).rejects.toMatchObject({ code: "EXPIRY_IN_PAST" });

    expect(prisma.task.create).not.toHaveBeenCalled();
    expect(prisma.vault.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an invalid budget before reserving anything", async () => {
    creatorExists();

    await expect(
      createTask(1, {
        options: [{ imageUrl: "a.jpg" }, { imageUrl: "b.jpg" }],
        budgetLamports: "1",
        maxSubmissions: 100,
      }),
    ).rejects.toMatchObject({ code: "BUDGET_TOO_SMALL" });

    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it("stores the reward and slot count on the task and reserves the exact total", async () => {
    creatorExists();
    prisma.task.create.mockResolvedValue({
      id: 42,
      title: "Pick one",
      amount: 500_000_000n,
      rewardPerSubmission: 10_000_000n,
      maxSubmissions: 50,
      options: [{ id: 1 }, { id: 2 }],
    });
    prisma.vault.updateMany.mockResolvedValue({ count: 1 });
    prisma.vault.findUniqueOrThrow.mockResolvedValue(
      vaultRow({ available: 9_500_000_000n, reserved: 500_000_000n }),
    );
    passthroughTransaction();

    await createTask(1, {
      options: [{ imageUrl: "a.jpg" }, { imageUrl: "b.jpg" }],
      budgetLamports: "500000000",
      maxSubmissions: 50,
      title: "Pick one",
    });

    const data = prisma.task.create.mock.calls[0][0].data;
    expect(data.amount).toBe(500_000_000n);
    expect(data.rewardPerSubmission).toBe(10_000_000n);
    expect(data.maxSubmissions).toBe(50);
    expect(data.vaultFunded).toBe(true);
    expect(data.options.create).toEqual([{ image_url: "a.jpg" }, { image_url: "b.jpg" }]);

    // Exactly what the slots can pay out — no more, no less.
    expect(prisma.vault.updateMany).toHaveBeenCalledWith({
      where: { id: VAULT_ID, available: { gte: 500_000_000n } },
      data: { available: { decrement: 500_000_000n }, reserved: { increment: 500_000_000n } },
    });
  });

  /**
   * The conditional `available >= amount` is what makes two concurrent creations
   * unable to spend the same balance twice.
   */
  it("refuses to create the task when the vault cannot cover it", async () => {
    creatorExists();
    prisma.task.create.mockResolvedValue({
      id: 42,
      title: "t",
      amount: 0n,
      rewardPerSubmission: 0n,
      maxSubmissions: 50,
      options: [],
    });
    prisma.vault.updateMany.mockResolvedValue({ count: 0 });
    prisma.vault.findUnique.mockResolvedValue(vaultRow({ available: 1_000n }));
    passthroughTransaction();

    await expect(
      createTask(1, {
        options: [{ imageUrl: "a.jpg" }, { imageUrl: "b.jpg" }],
        budgetLamports: "500000000",
        maxSubmissions: 50,
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_VAULT_BALANCE" });
  });
});

describe("cancelTask", () => {
  it("returns only the unfilled slots, leaving accepted work paid for", async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 1,
      title: "Pick one",
      user_id: 1,
      status: "OPEN",
      submissionCount: 30,
      user: { account_id: 10 },
    });
    prisma.task.updateMany.mockResolvedValue({ count: 1 });
    prisma.task.findUniqueOrThrow.mockResolvedValue({
      id: 1,
      title: "Pick one",
      user_id: 1,
      vaultFunded: true,
      rewardPerSubmission: 1_000_000n,
      maxSubmissions: 100,
      submissionCount: 30,
      refundedAmount: 0n,
    });
    prisma.user.findUnique.mockResolvedValue({ account: { vault: { id: VAULT_ID } } });
    prisma.vault.update.mockResolvedValue(vaultRow({ available: 70_000_000n }));
    passthroughTransaction();

    const result = await cancelTask(1, 1);

    // 70 unfilled slots × 0.001 SOL.
    expect(result.refunded).toBe("70000000");
    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { refundedAmount: { increment: 70_000_000n } },
    });
  });

  it("refuses to close a task that is already closed", async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 1,
      status: "COMPLETED",
      user: { account_id: 10 },
    });

    await expect(cancelTask(1, 1)).rejects.toMatchObject({ code: "TASK_NOT_OPEN" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("effectiveStatus", () => {
  it("reports an open task past its expiry as EXPIRED", () => {
    expect(effectiveStatus({ status: "OPEN" as any, expiresAt: new Date(Date.now() - 1000) })).toBe(
      "EXPIRED",
    );
  });

  it("leaves an open task with a future expiry alone", () => {
    expect(
      effectiveStatus({ status: "OPEN" as any, expiresAt: new Date(Date.now() + 60_000) }),
    ).toBe("OPEN");
  });

  it("never downgrades a completed task", () => {
    expect(
      effectiveStatus({ status: "COMPLETED" as any, expiresAt: new Date(Date.now() - 1000) }),
    ).toBe("COMPLETED");
  });
});

describe("getPublicTask", () => {
  it("exposes reward and capacity without leaking worker identities", async () => {
    prisma.task.findUnique.mockResolvedValue({
      id: 1,
      title: "Pick one",
      amount: 100_000_000n,
      rewardPerSubmission: 1_000_000n,
      maxSubmissions: 100,
      status: "OPEN",
      submissionCount: 40,
      expiresAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      options: [{ image_url: "https://cdn/a.jpg" }],
    });

    const task = await getPublicTask(1);

    expect(task).toMatchObject({
      rewardLamports: "1000000",
      spotsRemaining: 60,
      isOpen: true,
    });
    expect(JSON.stringify(task)).not.toContain("worker");
  });

  it("reports the task's own reward rather than deriving one", async () => {
    prisma.task.findUnique.mockResolvedValue({
      id: 2,
      title: "Pick one",
      amount: 100_000_000n,
      rewardPerSubmission: 20_000_000n,
      maxSubmissions: 5,
      status: "OPEN",
      submissionCount: 1,
      expiresAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      options: [],
    });

    const task = await getPublicTask(2);
    expect(task.rewardLamports).toBe("20000000");
    expect(task.spotsRemaining).toBe(4);
  });
});
