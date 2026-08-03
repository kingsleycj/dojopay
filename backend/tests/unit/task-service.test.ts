import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/prisma.js", () => ({
  prismaClient: {
    task: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn() },
    submission: { findMany: vi.fn() },
  },
  connectDB: vi.fn(),
  disconnectDB: vi.fn(),
}));

const getTransaction = vi.fn();

vi.mock("../../src/lib/solana.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/solana.js")>(
    "../../src/lib/solana.js",
  );
  return { ...actual, getConnection: () => ({ getTransaction }) };
});

const { prismaClient } = await import("../../src/lib/prisma.js");
const { createTask, effectiveStatus, getPublicTask, verifyFundingTransaction } = await import(
  "../../src/services/task.service.js"
);

const prisma = prismaClient as any;

const CREATOR = "8ZDbGsY7YJmSAvGHNRbnZQvfsyGgYw4mLUcQ6PPBpVHb";
const PLATFORM = "FPDb9L6L3kyBiw8LeXCcdza85PbSNxcZujXNkPrwEont";

/** Minimal shape of the pieces of a confirmed transfer the verifier inspects. */
function transferTx({
  credited = 100_000_000,
  payer = CREATOR,
  recipient = PLATFORM,
  err = null as unknown,
} = {}) {
  const keys = [payer, recipient];
  return {
    meta: {
      err,
      preBalances: [1_000_000_000, 0],
      postBalances: [1_000_000_000 - credited, credited],
    },
    transaction: {
      message: {
        getAccountKeys: () => ({
          length: keys.length,
          get: (index: number) => (keys[index] ? { toString: () => keys[index] } : undefined),
        }),
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.task.findUnique.mockResolvedValue(null);
});

describe("verifyFundingTransaction", () => {
  it("accepts a transfer of exactly the task price from the creator", async () => {
    getTransaction.mockResolvedValue(transferTx());
    await expect(verifyFundingTransaction("sig", CREATOR)).resolves.toBeUndefined();
  });

  /**
   * Replay protection. Without the unique signature check, one 0.1 SOL payment
   * could be submitted repeatedly to mint unlimited tasks.
   */
  it("rejects a signature that already funded a task", async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 1, signature: "sig" });

    await expect(verifyFundingTransaction("sig", CREATOR)).rejects.toMatchObject({
      code: "SIGNATURE_ALREADY_USED",
    });
    expect(getTransaction).not.toHaveBeenCalled();
  });

  /** The old verifier never inspected `meta.err`. */
  it("rejects a transaction that failed on chain", async () => {
    getTransaction.mockResolvedValue(transferTx({ err: { InstructionError: [0, "Custom"] } }));
    await expect(verifyFundingTransaction("sig", CREATOR)).rejects.toMatchObject({
      code: "TX_FAILED",
    });
  });

  it("rejects an underpayment", async () => {
    getTransaction.mockResolvedValue(transferTx({ credited: 50_000_000 }));
    await expect(verifyFundingTransaction("sig", CREATOR)).rejects.toMatchObject({
      code: "WRONG_AMOUNT",
    });
  });

  it("rejects an overpayment", async () => {
    getTransaction.mockResolvedValue(transferTx({ credited: 200_000_000 }));
    await expect(verifyFundingTransaction("sig", CREATOR)).rejects.toMatchObject({
      code: "WRONG_AMOUNT",
    });
  });

  it("rejects a transfer that never touches the platform wallet", async () => {
    getTransaction.mockResolvedValue(transferTx({ recipient: CREATOR }));
    await expect(verifyFundingTransaction("sig", CREATOR)).rejects.toMatchObject({
      code: "WRONG_RECIPIENT",
    });
  });

  it("rejects a transfer paid by somebody else's wallet", async () => {
    getTransaction.mockResolvedValue(transferTx());
    await expect(verifyFundingTransaction("sig", "SomeOtherWalletAddress1111111111111111111")).rejects.toMatchObject({
      code: "WRONG_PAYER",
    });
  });

  it("gives up after retrying a transaction that never appears", async () => {
    getTransaction.mockResolvedValue(null);
    await expect(verifyFundingTransaction("sig", CREATOR)).rejects.toMatchObject({
      code: "TX_NOT_FOUND",
    });
    expect(getTransaction.mock.calls.length).toBeGreaterThan(1);
  });
});

describe("createTask", () => {
  it("rejects an expiry in the past before touching the chain", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1, address: CREATOR });
    getTransaction.mockResolvedValue(transferTx());

    await expect(
      createTask(1, {
        options: [{ imageUrl: "a.jpg" }, { imageUrl: "b.jpg" }],
        signature: "sig",
        expirationDate: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).rejects.toMatchObject({ code: "EXPIRY_IN_PAST" });

    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it("creates the task and its options in one write", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1, address: CREATOR });
    getTransaction.mockResolvedValue(transferTx());
    prisma.task.create.mockResolvedValue({ id: 42, options: [] });

    await createTask(1, {
      options: [{ imageUrl: "a.jpg" }, { imageUrl: "b.jpg" }],
      signature: "sig",
      title: "Pick one",
    });

    const data = prisma.task.create.mock.calls[0][0].data;
    expect(data.amount).toBe(100_000_000n);
    expect(data.signature).toBe("sig");
    expect(data.options.create).toEqual([{ image_url: "a.jpg" }, { image_url: "b.jpg" }]);
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
});
