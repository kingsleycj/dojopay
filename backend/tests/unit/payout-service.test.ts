import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/prisma.js", () => ({
  prismaClient: {
    worker: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    payouts: { create: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  connectDB: vi.fn(),
  disconnectDB: vi.fn(),
}));

const sendAndConfirmTransaction = vi.fn();
const getBalance = vi.fn();

vi.mock("../../src/lib/solana.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/solana.js")>(
    "../../src/lib/solana.js",
  );
  return {
    ...actual,
    getConnection: () => ({
      getBalance,
      getLatestBlockhash: async () => ({ blockhash: "abc", lastValidBlockHeight: 1 }),
    }),
    getPlatformKeypair: () => ({ publicKey: { toString: () => "platform" } }),
  };
});

vi.mock("@solana/web3.js", async () => {
  const actual = await vi.importActual<typeof import("@solana/web3.js")>("@solana/web3.js");
  return { ...actual, sendAndConfirmTransaction };
});

vi.mock("tweetnacl", () => ({
  default: { sign: { detached: { verify: vi.fn(() => true) } } },
}));

const { prismaClient } = await import("../../src/lib/prisma.js");
const { buildWithdrawalMessage, requestPayout } = await import("../../src/services/payout.service.js");
const nacl = (await import("tweetnacl")).default as any;

const prisma = prismaClient as any;

const WORKER_ADDRESS = "FPDb9L6L3kyBiw8LeXCcdza85PbSNxcZujXNkPrwEont";

/**
 * Worker rows now hang off an Account, which owns the wallet address — the
 * withdrawal destination comes from `account.walletAddress`, not the worker.
 */
function worker(pending: bigint, walletAddress: string | null = WORKER_ADDRESS) {
  return {
    id: 5,
    pending_amount: pending,
    withdrawn_amount: 0n,
    account: { id: 50, walletAddress },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  nacl.sign.detached.verify.mockReturnValue(true);
  getBalance.mockResolvedValue(10_000_000_000);
  prisma.worker.updateMany.mockResolvedValue({ count: 1 });
  prisma.$transaction.mockImplementation(async (fn: any) =>
    fn({ worker: prisma.worker, payouts: prisma.payouts }),
  );
});

describe("buildWithdrawalMessage", () => {
  it("binds the signature to both amount and destination", () => {
    expect(buildWithdrawalMessage(5_000_000n, WORKER_ADDRESS)).toBe(
      `Withdraw 5000000 lamports to ${WORKER_ADDRESS}`,
    );
  });
});

describe("requestPayout", () => {
  it("pays out and records a SUCCESS payout on confirmation", async () => {
    prisma.worker.findUnique.mockResolvedValue(worker(5_000_000n));
    sendAndConfirmTransaction.mockResolvedValue("tx-signature-1");

    const result = await requestPayout(5, "sig");

    expect(result).toMatchObject({ signature: "tx-signature-1", amount: "5000000" });
    expect(prisma.payouts.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "SUCCESS", signature: "tx-signature-1" }),
    });
  });

  /**
   * The core money-safety property: funds leave the pending balance *before*
   * the transfer is broadcast. Sending first, as the old code did, let two
   * concurrent requests read the same balance and pay it out twice.
   */
  it("debits the pending balance before broadcasting", async () => {
    prisma.worker.findUnique.mockResolvedValue(worker(5_000_000n));

    const order: string[] = [];
    prisma.worker.updateMany.mockImplementation(async () => {
      order.push("debit");
      return { count: 1 };
    });
    sendAndConfirmTransaction.mockImplementation(async () => {
      order.push("send");
      return "tx-signature-2";
    });

    await requestPayout(5, "sig");

    expect(order).toEqual(["debit", "send"]);
  });

  it("aborts when the balance changed between read and debit", async () => {
    prisma.worker.findUnique.mockResolvedValue(worker(5_000_000n));
    prisma.worker.updateMany.mockResolvedValue({ count: 0 });

    await expect(requestPayout(5, "sig")).rejects.toMatchObject({ code: "BALANCE_CHANGED" });
    expect(sendAndConfirmTransaction).not.toHaveBeenCalled();
  });

  it("restores the balance and records FAILED when the transfer fails", async () => {
    prisma.worker.findUnique.mockResolvedValue(worker(5_000_000n));
    sendAndConfirmTransaction.mockRejectedValue(new Error("block height exceeded"));

    await expect(requestPayout(5, "sig")).rejects.toMatchObject({ code: "PAYOUT_FAILED" });

    expect(prisma.worker.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { pending_amount: { increment: 5_000_000n } },
    });
    expect(prisma.payouts.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "FAILED" }),
    });
  });

  it("refuses a withdrawal below the dust minimum", async () => {
    prisma.worker.findUnique.mockResolvedValue(worker(1_000n));
    await expect(requestPayout(5, "sig")).rejects.toMatchObject({ code: "BELOW_MINIMUM" });
    expect(prisma.worker.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a withdrawal with nothing pending", async () => {
    prisma.worker.findUnique.mockResolvedValue(worker(0n));
    await expect(requestPayout(5, "sig")).rejects.toMatchObject({ code: "NO_PENDING_EARNINGS" });
  });

  it("refuses an invalid wallet signature and does not debit", async () => {
    prisma.worker.findUnique.mockResolvedValue(worker(5_000_000n));
    nacl.sign.detached.verify.mockReturnValue(false);

    await expect(requestPayout(5, "sig")).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
    expect(prisma.worker.updateMany).not.toHaveBeenCalled();
    expect(sendAndConfirmTransaction).not.toHaveBeenCalled();
  });

  it("refuses when the platform wallet cannot cover the transfer plus fee", async () => {
    prisma.worker.findUnique.mockResolvedValue(worker(5_000_000n));
    getBalance.mockResolvedValue(1_000);

    await expect(requestPayout(5, "sig")).rejects.toMatchObject({
      code: "INSUFFICIENT_PLATFORM_FUNDS",
    });
    expect(prisma.worker.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an unknown worker", async () => {
    prisma.worker.findUnique.mockResolvedValue(null);
    await expect(requestPayout(5, "sig")).rejects.toMatchObject({ code: "WORKER_NOT_FOUND" });
  });

  /**
   * The wallet gate. An account can sign up with only an email and earn by
   * completing tasks, but SOL needs a destination — so a withdrawal without a
   * linked wallet is refused before anything is debited.
   */
  it("refuses to pay an account with no linked wallet", async () => {
    prisma.worker.findUnique.mockResolvedValue(worker(5_000_000n, null));

    await expect(requestPayout(5, "sig")).rejects.toMatchObject({ code: "WALLET_REQUIRED" });
    expect(prisma.worker.updateMany).not.toHaveBeenCalled();
    expect(sendAndConfirmTransaction).not.toHaveBeenCalled();
  });

  it("records the payout lifecycle in the audit log", async () => {
    prisma.worker.findUnique.mockResolvedValue(worker(5_000_000n));
    sendAndConfirmTransaction.mockResolvedValue("tx-signature-3");

    await requestPayout(5, "sig");

    const actions = prisma.auditLog.create.mock.calls.map((call: any) => call[0].data.action);
    expect(actions).toContain("PAYOUT_REQUESTED");
    expect(actions).toContain("PAYOUT_SUCCEEDED");
  });

  it("never writes credential material into audit metadata", async () => {
    prisma.worker.findUnique.mockResolvedValue(worker(5_000_000n));
    sendAndConfirmTransaction.mockResolvedValue("tx-signature-4");

    await requestPayout(5, "sig");

    for (const call of prisma.auditLog.create.mock.calls) {
      const serialised = JSON.stringify(call[0].data.metadata ?? {});
      expect(serialised).not.toContain("passwordHash");
      expect(serialised).not.toContain("totpSecret");
    }
  });
});
