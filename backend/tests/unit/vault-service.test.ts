import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/prisma.js", () => ({
  prismaClient: {
    account: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    task: { update: vi.fn(), findUniqueOrThrow: vi.fn() },
    vault: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    vaultEntry: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    payouts: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  connectDB: vi.fn(),
  disconnectDB: vi.fn(),
}));

const verifyIncomingTransfer = vi.fn();

vi.mock("../../src/lib/solana.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/solana.js")>(
    "../../src/lib/solana.js",
  );
  return { ...actual, verifyIncomingTransfer };
});

const { prismaClient } = await import("../../src/lib/prisma.js");
const {
  depositToVault,
  ensureVault,
  refundTaskRemainder,
  releaseReward,
  reserveForTask,
  serializeVault,
} = await import("../../src/services/vault.service.js");
const { MIN_DEPOSIT_LAMPORTS, MIN_WITHDRAWAL_LAMPORTS } = await import(
  "../../src/config/index.js"
);

const prisma = prismaClient as any;

const WALLET = "8ZDbGsY7YJmSAvGHNRbnZQvfsyGgYw4mLUcQ6PPBpVHb";
const VAULT_ID = 77;

function tx() {
  return {
    task: prisma.task,
    user: prisma.user,
    vault: prisma.vault,
    vaultEntry: prisma.vaultEntry,
  } as any;
}

function passthroughTransaction() {
  prisma.$transaction.mockImplementation(async (fn: any) => fn(tx()));
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyIncomingTransfer.mockResolvedValue({ rejection: null, lamports: 500_000_000n, payer: WALLET });
});

describe("ensureVault", () => {
  it("returns the existing vault rather than creating a second one", async () => {
    prisma.vault.findUnique.mockResolvedValue({ id: VAULT_ID, account_id: 10 });

    const vault = await ensureVault(10);

    expect(vault.id).toBe(VAULT_ID);
    expect(prisma.vault.create).not.toHaveBeenCalled();
  });

  /**
   * Two first-uses racing on the unique account_id. The loser must read the
   * winner's row, not fail the request that happened to trigger creation.
   */
  it("recovers from losing the creation race", async () => {
    const { Prisma } = await import("@prisma/client");
    prisma.vault.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: VAULT_ID, account_id: 10 });
    prisma.vault.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "5.19.1",
      }),
    );

    const vault = await ensureVault(10);
    expect(vault.id).toBe(VAULT_ID);
  });
});

describe("serializeVault", () => {
  const vault = {
    available: 500_000n,
    reserved: 200_000_000n,
    totalDeposited: 1_000_000_000n,
    totalWithdrawn: 0n,
    totalSpent: 0n,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  } as any;

  it("reports total as available plus reserved", () => {
    expect(serializeVault(vault).total).toBe("200500000");
  });

  /**
   * A balance below the network-fee floor is not withdrawable, and showing it as
   * such is how a worker ends up clicking a button that always fails.
   */
  it("reports nothing as withdrawable below the minimum", () => {
    expect(serializeVault(vault).withdrawable).toBe("0");
    expect(
      serializeVault({ ...vault, available: MIN_WITHDRAWAL_LAMPORTS }).withdrawable,
    ).toBe(MIN_WITHDRAWAL_LAMPORTS.toString());
  });

  /** Reserved SOL is promised to workers, so it can never be withdrawn. */
  it("never counts reserved SOL as withdrawable", () => {
    const serialized = serializeVault({ ...vault, available: 0n, reserved: 10_000_000_000n });
    expect(serialized.withdrawable).toBe("0");
  });
});

describe("depositToVault", () => {
  beforeEach(() => {
    prisma.account.findUnique.mockResolvedValue({ walletAddress: WALLET });
    prisma.vaultEntry.findUnique.mockResolvedValue(null);
    prisma.vault.findUnique.mockResolvedValue({ id: VAULT_ID, account_id: 10 });
    prisma.vault.update.mockResolvedValue({
      id: VAULT_ID,
      available: 500_000_000n,
      reserved: 0n,
      totalDeposited: 500_000_000n,
      totalWithdrawn: 0n,
      totalSpent: 0n,
      updatedAt: new Date(),
    });
    passthroughTransaction();
  });

  it("credits the amount the chain says arrived", async () => {
    await depositToVault(10, "sig");

    expect(prisma.vault.update).toHaveBeenCalledWith({
      where: { id: VAULT_ID },
      data: {
        available: { increment: 500_000_000n },
        totalDeposited: { increment: 500_000_000n },
      },
    });
  });

  /**
   * Replay protection, moved from `Task.signature` to where deposits now land.
   * Without it one transfer could be submitted repeatedly for free balance.
   */
  it("refuses a signature that has already been credited", async () => {
    prisma.vaultEntry.findUnique.mockResolvedValue({ id: 1, signature: "sig" });

    await expect(depositToVault(10, "sig")).rejects.toMatchObject({
      code: "SIGNATURE_ALREADY_USED",
    });
    expect(verifyIncomingTransfer).not.toHaveBeenCalled();
  });

  it("refuses a deposit that failed on chain", async () => {
    verifyIncomingTransfer.mockResolvedValue({ rejection: "TX_FAILED", lamports: 0n, payer: "" });

    await expect(depositToVault(10, "sig")).rejects.toMatchObject({ code: "TX_FAILED" });
    expect(prisma.vault.update).not.toHaveBeenCalled();
  });

  it("refuses a deposit sent by a wallet the account has not proven it controls", async () => {
    verifyIncomingTransfer.mockResolvedValue({ rejection: "WRONG_PAYER", lamports: 0n, payer: "x" });

    await expect(depositToVault(10, "sig")).rejects.toMatchObject({ code: "WRONG_PAYER" });
  });

  it("refuses a top-up below the minimum", async () => {
    verifyIncomingTransfer.mockResolvedValue({
      rejection: null,
      lamports: MIN_DEPOSIT_LAMPORTS - 1n,
      payer: WALLET,
    });

    await expect(depositToVault(10, "sig")).rejects.toMatchObject({
      code: "BELOW_MINIMUM_DEPOSIT",
    });
  });

  it("refuses to credit an account with no linked wallet", async () => {
    prisma.account.findUnique.mockResolvedValue({ walletAddress: null });

    await expect(depositToVault(10, "sig")).rejects.toMatchObject({ code: "WALLET_REQUIRED" });
  });
});

describe("reserveForTask", () => {
  it("moves the amount from available to reserved and records it", async () => {
    prisma.vault.updateMany.mockResolvedValue({ count: 1 });
    prisma.vault.findUniqueOrThrow.mockResolvedValue({
      id: VAULT_ID,
      available: 500_000_000n,
      reserved: 500_000_000n,
    });

    await reserveForTask(tx(), VAULT_ID, 500_000_000n, { taskId: 1, description: "Task" });

    expect(prisma.vaultEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "TASK_FUNDED",
          amount: 500_000_000n,
          availableAfter: 500_000_000n,
          reservedAfter: 500_000_000n,
        }),
      }),
    );
  });

  it("refuses when the vault cannot cover the amount", async () => {
    prisma.vault.updateMany.mockResolvedValue({ count: 0 });
    prisma.vault.findUnique.mockResolvedValue({ id: VAULT_ID, available: 1_000n });

    await expect(
      reserveForTask(tx(), VAULT_ID, 500_000_000n, { taskId: 1 }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_VAULT_BALANCE" });

    expect(prisma.vaultEntry.create).not.toHaveBeenCalled();
  });
});

describe("releaseReward", () => {
  it("draws the reward out of reserved and into spent", async () => {
    prisma.vault.update.mockResolvedValue({ id: VAULT_ID, available: 0n, reserved: 99_000_000n });

    await releaseReward(tx(), VAULT_ID, 1_000_000n, { taskId: 1 });

    expect(prisma.vault.update).toHaveBeenCalledWith({
      where: { id: VAULT_ID },
      data: { reserved: { increment: -1_000_000n }, totalSpent: { increment: 1_000_000n } },
    });
  });

  /**
   * A negative balance means an accounting bug upstream. Persisting one would
   * turn a bug into missing money, so the transaction is aborted instead.
   */
  it("aborts rather than persisting a negative balance", async () => {
    prisma.vault.update.mockResolvedValue({ id: VAULT_ID, available: 0n, reserved: -1n });

    await expect(releaseReward(tx(), VAULT_ID, 1_000_000n, { taskId: 1 })).rejects.toMatchObject({
      code: "VAULT_INVARIANT_VIOLATED",
    });
    expect(prisma.vaultEntry.create).not.toHaveBeenCalled();
  });
});

describe("refundTaskRemainder", () => {
  const task = {
    id: 1,
    title: "Pick one",
    user_id: 1,
    vaultFunded: true,
    rewardPerSubmission: 1_000_000n,
    maxSubmissions: 100,
    submissionCount: 30,
    refundedAmount: 0n,
  };

  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ account: { vault: { id: VAULT_ID } } });
    prisma.vault.update.mockResolvedValue({ id: VAULT_ID, available: 70_000_000n, reserved: 0n });
  });

  it("returns exactly the unfilled slots", async () => {
    const refunded = await refundTaskRemainder(tx(), task);
    expect(refunded).toBe(70_000_000n);
  });

  /**
   * Idempotent by construction: the amount owed is computed net of what has
   * already been refunded, so running the expiry sweep twice cannot pay twice.
   */
  it("refunds nothing on a second pass", async () => {
    const refunded = await refundTaskRemainder(tx(), { ...task, refundedAmount: 70_000_000n });

    expect(refunded).toBe(0n);
    expect(prisma.vault.update).not.toHaveBeenCalled();
  });

  it("refunds nothing for a fully subscribed task", async () => {
    const refunded = await refundTaskRemainder(tx(), { ...task, submissionCount: 100 });
    expect(refunded).toBe(0n);
  });

  /** Pre-vault tasks have no reservation to give back. */
  it("skips tasks created before vaults existed", async () => {
    const refunded = await refundTaskRemainder(tx(), { ...task, vaultFunded: false });

    expect(refunded).toBe(0n);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
