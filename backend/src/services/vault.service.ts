import {
  PayoutStatus,
  Prisma,
  VaultEntryStatus,
  VaultEntryType,
  type Vault,
} from "@prisma/client";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import {
  ESTIMATED_TX_FEE_LAMPORTS,
  MIN_DEPOSIT_LAMPORTS,
  MIN_WITHDRAWAL_LAMPORTS,
} from "../config/index.js";
import { prismaClient, type PrismaTx } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import {
  getConnection,
  getPlatformKeypair,
  getPlatformWalletAddress,
  toSignatureBytes,
  verifyIncomingTransfer,
  type TransferRejection,
} from "../lib/solana.js";
import { badRequest, conflict, forbidden, serverError, unauthorized } from "../utils/errors.js";
import { AuditAction, auditAccount, type AuditContext } from "./audit.service.js";

/**
 * Per-account vaults.
 *
 * The previous money model had one shape: pay 0.1 SOL, get one task, and the
 * platform wallet was the only record that the payment happened. Nothing tracked
 * *whose* SOL was in there, nothing could give it back, and the amount was not
 * the creator's to choose.
 *
 * A vault fixes all three. It is a per-account ledger over the same custodial
 * wallet: `available` is spendable, `reserved` is committed to open tasks, and
 * every movement writes a `VaultEntry` carrying the balances it produced. The
 * invariant the whole module exists to hold is:
 *
 *     available + reserved  ==  deposited - withdrawn - spent + refunded
 *
 * and the sum of every vault's `available + reserved`, plus every worker's
 * `pending_amount`, is what the platform wallet must be able to honour.
 *
 * This is still custody — the platform *can* move the SOL. What it can no longer
 * do is lose track of who it belongs to. Phase 6's escrow program removes the
 * custody itself; the vault is the ledger that makes that swap possible one task
 * at a time rather than as a flag day.
 */

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Get or create the vault for an account. Lazy, like the role profiles. */
export async function ensureVault(accountId: number, context?: AuditContext): Promise<Vault> {
  const existing = await prismaClient.vault.findUnique({ where: { account_id: accountId } });
  if (existing) return existing;

  try {
    const vault = await prismaClient.vault.create({ data: { account_id: accountId } });
    await auditAccount(accountId, AuditAction.VAULT_CREATED, {
      entityType: "vault",
      entityId: vault.id,
      context,
    });
    return vault;
  } catch (error) {
    // Two concurrent first-uses race on the unique account_id. The loser reads
    // the winner's row rather than failing the request that triggered it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const vault = await prismaClient.vault.findUnique({ where: { account_id: accountId } });
      if (vault) return vault;
    }
    throw error;
  }
}

export function serializeVault(vault: Vault) {
  return {
    available: vault.available.toString(),
    reserved: vault.reserved.toString(),
    /** What the account owns in total — the number to show as "balance". */
    total: (vault.available + vault.reserved).toString(),
    totalDeposited: vault.totalDeposited.toString(),
    totalWithdrawn: vault.totalWithdrawn.toString(),
    totalSpent: vault.totalSpent.toString(),
    /** Withdrawable right now: reserved SOL belongs to open tasks. */
    withdrawable: (
      vault.available >= MIN_WITHDRAWAL_LAMPORTS ? vault.available : 0n
    ).toString(),
    minimumDeposit: MIN_DEPOSIT_LAMPORTS.toString(),
    minimumWithdrawal: MIN_WITHDRAWAL_LAMPORTS.toString(),
    updatedAt: vault.updatedAt.toISOString(),
  };
}

export async function getVaultSummary(accountId: number) {
  const vault = await ensureVault(accountId);
  return serializeVault(vault);
}

/** Paginated statement. Every balance change, newest first. */
export async function listVaultEntries(accountId: number, page: number, limit: number) {
  const vault = await ensureVault(accountId);

  const [total, entries] = await Promise.all([
    prismaClient.vaultEntry.count({ where: { vault_id: vault.id } }),
    prismaClient.vaultEntry.findMany({
      where: { vault_id: vault.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { task: { select: { id: true, title: true } } },
    }),
  ]);

  return {
    vault: serializeVault(vault),
    entries: entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      status: entry.status,
      amount: entry.amount.toString(),
      availableAfter: entry.availableAfter.toString(),
      reservedAfter: entry.reservedAfter.toString(),
      signature: entry.signature,
      taskId: entry.task?.id ?? null,
      taskTitle: entry.task?.title ?? null,
      description: entry.description,
      createdAt: entry.createdAt.toISOString(),
      /** Whether this entry added to or removed from what the account owns. */
      direction: DIRECTION[entry.type],
    })),
    pagination: {
      currentPage: page,
      itemsPerPage: limit,
      totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
}

const DIRECTION: Record<VaultEntryType, "in" | "out" | "internal"> = {
  DEPOSIT: "in",
  TASK_REFUND: "internal",
  TASK_FUNDED: "internal",
  WITHDRAWAL: "out",
  REWARD_RELEASED: "out",
};

// ---------------------------------------------------------------------------
// Writes — all of these run inside a transaction and write a ledger entry
// ---------------------------------------------------------------------------

type Tx = PrismaTx;

/**
 * Apply a balance delta and record it.
 *
 * Every mutation in this module goes through here so no code path can move a
 * balance without leaving a ledger row behind, and so `availableAfter` /
 * `reservedAfter` are always the balances that actually resulted rather than a
 * caller's guess at them.
 */
async function applyEntry(
  tx: Tx,
  vaultId: number,
  delta: {
    available?: bigint;
    reserved?: bigint;
    totalDeposited?: bigint;
    totalWithdrawn?: bigint;
    totalSpent?: bigint;
  },
  entry: {
    type: VaultEntryType;
    amount: bigint;
    status?: VaultEntryStatus;
    signature?: string | null;
    taskId?: number | null;
    description?: string | null;
  },
) {
  const vault = await tx.vault.update({
    where: { id: vaultId },
    data: {
      ...(delta.available === undefined ? {} : { available: { increment: delta.available } }),
      ...(delta.reserved === undefined ? {} : { reserved: { increment: delta.reserved } }),
      ...(delta.totalDeposited === undefined
        ? {}
        : { totalDeposited: { increment: delta.totalDeposited } }),
      ...(delta.totalWithdrawn === undefined
        ? {}
        : { totalWithdrawn: { increment: delta.totalWithdrawn } }),
      ...(delta.totalSpent === undefined ? {} : { totalSpent: { increment: delta.totalSpent } }),
    },
  });

  // A negative balance means an accounting bug upstream, and quietly persisting
  // one would turn a bug into missing money. Aborting rolls the whole
  // transaction back.
  if (vault.available < 0n || vault.reserved < 0n) {
    throw serverError(
      "Vault balance would go negative — refusing to apply this entry.",
      "VAULT_INVARIANT_VIOLATED",
    );
  }

  const created = await tx.vaultEntry.create({
    data: {
      vault_id: vaultId,
      type: entry.type,
      status: entry.status ?? VaultEntryStatus.SUCCESS,
      amount: entry.amount,
      availableAfter: vault.available,
      reservedAfter: vault.reserved,
      signature: entry.signature ?? null,
      task_id: entry.taskId ?? null,
      description: entry.description ?? null,
    },
  });

  return { vault, entry: created };
}

const REJECTION_MESSAGE: Record<TransferRejection, string> = {
  TX_NOT_FOUND:
    "That transaction is not on chain yet. If your wallet has just confirmed it, wait a moment and try again.",
  TX_FAILED: "That transaction failed on chain, so nothing was transferred.",
  WRONG_RECIPIENT: "That transaction did not send SOL to the DojoPay platform wallet.",
  WRONG_PAYER: "That deposit was not sent by the wallet linked to this account.",
};

/**
 * Credit a confirmed on-chain deposit.
 *
 * The signature is checked against the chain and then stored on the entry under
 * a unique constraint, which is what makes a replayed request a no-op rather
 * than free money — the same guarantee `Task.signature` used to provide, moved
 * to where deposits now happen.
 */
export async function depositToVault(
  accountId: number,
  signature: string,
  context?: AuditContext,
) {
  const account = await prismaClient.account.findUnique({
    where: { id: accountId },
    select: { walletAddress: true },
  });

  if (!account?.walletAddress) {
    throw badRequest(
      "Connect a Solana wallet before topping up — the deposit has to come from a wallet you have proven you control.",
      "WALLET_REQUIRED",
    );
  }

  const already = await prismaClient.vaultEntry.findUnique({ where: { signature } });
  if (already) {
    throw conflict("This transaction has already been credited", "SIGNATURE_ALREADY_USED");
  }

  const result = await verifyIncomingTransfer(signature, account.walletAddress);

  if (result.rejection) {
    throw badRequest(REJECTION_MESSAGE[result.rejection], result.rejection);
  }

  const amount = result.lamports;

  if (amount < MIN_DEPOSIT_LAMPORTS) {
    throw badRequest(
      `Minimum top-up is ${MIN_DEPOSIT_LAMPORTS} lamports; that transaction moved ${amount}`,
      "BELOW_MINIMUM_DEPOSIT",
      { minimum: MIN_DEPOSIT_LAMPORTS.toString(), received: amount.toString() },
    );
  }

  const vault = await ensureVault(accountId, context);

  try {
    const { vault: updated } = await prismaClient.$transaction((tx) =>
      applyEntry(
        tx,
        vault.id,
        { available: amount, totalDeposited: amount },
        {
          type: VaultEntryType.DEPOSIT,
          amount,
          signature,
          description: "Wallet top-up",
        },
      ),
    );

    await auditAccount(accountId, AuditAction.VAULT_DEPOSIT, {
      entityType: "vault",
      entityId: vault.id,
      metadata: { amountLamports: amount.toString(), signature },
      context,
    });

    logger.info("Vault deposit credited", { accountId, amount: amount.toString(), signature });
    return serializeVault(updated);
  } catch (error) {
    // Two requests racing on the same signature: the unique index means exactly
    // one credits, and the loser sees the same message as a plain replay.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflict("This transaction has already been credited", "SIGNATURE_ALREADY_USED");
    }
    throw error;
  }
}

/**
 * Move `amount` from available to reserved for a task.
 *
 * Runs inside the caller's transaction so the reservation and the task row are
 * one atomic act — a task can never exist without its funding, and funding can
 * never be taken for a task that failed to create.
 *
 * The conditional `updateMany` is what makes it race-safe: two task creations
 * competing for the same balance cannot both see it as sufficient, because the
 * second one's `available >= amount` predicate no longer matches.
 */
export async function reserveForTask(
  tx: Tx,
  vaultId: number,
  amount: bigint,
  options: { taskId?: number; description?: string },
) {
  const claimed = await tx.vault.updateMany({
    where: { id: vaultId, available: { gte: amount } },
    data: { available: { decrement: amount }, reserved: { increment: amount } },
  });

  if (claimed.count === 0) {
    const current = await tx.vault.findUnique({ where: { id: vaultId } });
    throw badRequest(
      "Your vault does not have enough available SOL to fund this task.",
      "INSUFFICIENT_VAULT_BALANCE",
      {
        required: amount.toString(),
        available: (current?.available ?? 0n).toString(),
      },
    );
  }

  const vault = await tx.vault.findUniqueOrThrow({ where: { id: vaultId } });

  await tx.vaultEntry.create({
    data: {
      vault_id: vaultId,
      type: VaultEntryType.TASK_FUNDED,
      amount,
      availableAfter: vault.available,
      reservedAfter: vault.reserved,
      task_id: options.taskId ?? null,
      description: options.description ?? "Task funded",
    },
  });

  return vault;
}

/**
 * Release one worker's reward out of a task's reservation.
 *
 * Called from inside the submission transaction, so a worker's balance going up
 * and the creator's reservation going down are the same event. Before vaults
 * these were unrelated: the worker was credited and nothing anywhere recorded
 * that a creator's funding had been consumed.
 */
export async function releaseReward(
  tx: Tx,
  vaultId: number,
  amount: bigint,
  options: { taskId: number; description?: string },
) {
  return applyEntry(
    tx,
    vaultId,
    { reserved: -amount, totalSpent: amount },
    {
      type: VaultEntryType.REWARD_RELEASED,
      amount,
      taskId: options.taskId,
      description: options.description ?? "Submission reward paid",
    },
  );
}

/**
 * Return a closed task's unfilled slots to the creator's available balance.
 *
 * Idempotent by construction: it reserves nothing it has already refunded,
 * because `refundedAmount` is written in the same transaction and the amount is
 * computed from it. Running the expiry sweep twice cannot pay a creator twice.
 */
export async function refundTaskRemainder(
  tx: Tx,
  task: {
    id: number;
    title: string;
    user_id: number;
    vaultFunded: boolean;
    rewardPerSubmission: bigint;
    maxSubmissions: number;
    submissionCount: number;
    refundedAmount: bigint;
  },
): Promise<bigint> {
  // Tasks created before vaults existed have no reservation to give back.
  if (!task.vaultFunded) return 0n;

  const unfilled = BigInt(Math.max(0, task.maxSubmissions - task.submissionCount));
  const owed = unfilled * task.rewardPerSubmission - task.refundedAmount;
  if (owed <= 0n) return 0n;

  const creator = await tx.user.findUnique({
    where: { id: task.user_id },
    select: { account: { select: { vault: { select: { id: true } } } } },
  });

  const vaultId = creator?.account.vault?.id;
  if (!vaultId) {
    // A vault-funded task whose vault has vanished is a data problem, not a
    // reason to fail the sweep for every other task in the batch.
    logger.error("Vault-funded task has no vault to refund into", { taskId: task.id });
    return 0n;
  }

  await tx.task.update({
    where: { id: task.id },
    data: { refundedAmount: { increment: owed } },
  });

  await applyEntry(
    tx,
    vaultId,
    { available: owed, reserved: -owed },
    {
      type: VaultEntryType.TASK_REFUND,
      amount: owed,
      taskId: task.id,
      description: `Unused budget returned — ${task.title}`,
    },
  );

  return owed;
}

// ---------------------------------------------------------------------------
// Withdrawal
// ---------------------------------------------------------------------------

export function buildVaultWithdrawalMessage(lamports: bigint, address: string): string {
  return `Withdraw ${lamports} lamports from your DojoPay vault to ${address}`;
}

function verifyWithdrawalSignature(walletAddress: string, lamports: bigint, signature: unknown) {
  let bytes: Uint8Array;
  try {
    bytes = toSignatureBytes(signature);
  } catch {
    throw badRequest("Invalid signature format", "INVALID_SIGNATURE_FORMAT");
  }

  const verified = nacl.sign.detached.verify(
    new TextEncoder().encode(buildVaultWithdrawalMessage(lamports, walletAddress)),
    bytes,
    new PublicKey(walletAddress).toBytes(),
  );

  if (!verified) throw unauthorized("Invalid withdrawal signature", "INVALID_SIGNATURE");
}

/**
 * Send a creator's unreserved vault balance back to their wallet.
 *
 * Mirrors the worker payout, and holds the same two properties: the balance is
 * debited *before* the transfer is broadcast so two concurrent requests cannot
 * both pay out, and the entry ends SUCCESS or FAILED with a failure restoring
 * the balance — never a PROCESSING row that nothing ever updates.
 *
 * `reserved` is deliberately not withdrawable. That SOL is promised to workers
 * who have not answered yet; letting a creator pull it back would make every
 * open task an IOU.
 */
export async function withdrawFromVault(
  accountId: number,
  signature: unknown,
  context?: AuditContext,
) {
  const account = await prismaClient.account.findUnique({
    where: { id: accountId },
    select: { walletAddress: true },
  });

  if (!account?.walletAddress) {
    throw forbidden(
      "Connect a Solana wallet before withdrawing — that is where your SOL will be sent.",
      "WALLET_REQUIRED",
    );
  }
  const walletAddress = account.walletAddress;

  const vault = await ensureVault(accountId, context);
  const amount = vault.available;

  if (amount <= 0n) {
    throw badRequest("Your vault has no available balance to withdraw", "NO_AVAILABLE_BALANCE");
  }

  if (amount < MIN_WITHDRAWAL_LAMPORTS) {
    throw badRequest(
      `Minimum withdrawal is ${MIN_WITHDRAWAL_LAMPORTS} lamports; you have ${amount} available`,
      "BELOW_MINIMUM",
      { minimum: MIN_WITHDRAWAL_LAMPORTS.toString(), available: amount.toString() },
    );
  }

  // The creator signs the exact amount, so a captured signature cannot
  // authorise a later, larger withdrawal.
  verifyWithdrawalSignature(walletAddress, amount, signature);

  const connection = getConnection();
  const platformWallet = getPlatformWalletAddress();

  const balance = await connection.getBalance(platformWallet);
  if (BigInt(balance) < amount + BigInt(ESTIMATED_TX_FEE_LAMPORTS)) {
    logger.error("Platform wallet underfunded for vault withdrawal", { balance, amount: amount.toString() });
    throw serverError(
      "The platform wallet is temporarily unable to cover withdrawals. Please try again shortly.",
      "INSUFFICIENT_PLATFORM_FUNDS",
    );
  }

  // Debit first. A conditional update on the exact balance means a concurrent
  // withdrawal or a task funding that landed in between makes this a no-op.
  const debited = await prismaClient.vault.updateMany({
    where: { id: vault.id, available: amount },
    data: { available: 0n, totalWithdrawn: { increment: amount } },
  });

  if (debited.count === 0) {
    throw badRequest("Your vault balance changed, please retry the withdrawal", "BALANCE_CHANGED");
  }

  await auditAccount(accountId, AuditAction.VAULT_WITHDRAWAL_REQUESTED, {
    entityType: "vault",
    entityId: vault.id,
    metadata: { amountLamports: amount.toString(), destination: walletAddress },
    context,
  });

  let txSignature: string;
  try {
    const keypair = getPlatformKeypair();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const transaction = new Transaction({
      feePayer: platformWallet,
      blockhash,
      lastValidBlockHeight,
    }).add(
      SystemProgram.transfer({
        fromPubkey: platformWallet,
        toPubkey: new PublicKey(walletAddress),
        lamports: Number(amount),
      }),
    );

    txSignature = await sendAndConfirmTransaction(connection, transaction, [keypair], {
      commitment: "confirmed",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Vault withdrawal transfer failed", { accountId, amount: amount.toString(), error: message });

    // Put it back. The creator keeps their balance.
    await prismaClient.$transaction(async (tx) => {
      await tx.vault.update({
        where: { id: vault.id },
        data: { available: { increment: amount }, totalWithdrawn: { decrement: amount } },
      });
      const restored = await tx.vault.findUniqueOrThrow({ where: { id: vault.id } });
      await tx.vaultEntry.create({
        data: {
          vault_id: vault.id,
          type: VaultEntryType.WITHDRAWAL,
          status: VaultEntryStatus.FAILED,
          amount,
          availableAfter: restored.available,
          reservedAfter: restored.reserved,
          description: "Withdrawal failed — balance restored",
        },
      });
    });

    await auditAccount(accountId, AuditAction.VAULT_WITHDRAWAL_FAILED, {
      entityType: "vault",
      entityId: vault.id,
      metadata: { amountLamports: amount.toString(), error: message },
      context,
    });

    throw serverError(describeTransferFailure(message), "WITHDRAWAL_FAILED");
  }

  const updated = await prismaClient.$transaction(async (tx) => {
    const current = await tx.vault.findUniqueOrThrow({ where: { id: vault.id } });

    await tx.vaultEntry.create({
      data: {
        vault_id: vault.id,
        type: VaultEntryType.WITHDRAWAL,
        status: VaultEntryStatus.SUCCESS,
        amount,
        availableAfter: current.available,
        reservedAfter: current.reserved,
        signature: txSignature,
        description: "Withdrawn to wallet",
      },
    });

    // Recorded as a `Payouts` row too, so creator and worker withdrawals share
    // one history and the admin view does not need a second place to look.
    const creator = await tx.user.findUnique({ where: { account_id: accountId } });
    if (creator) {
      await tx.payouts.create({
        data: {
          user_id: creator.id,
          amount,
          signature: txSignature,
          status: PayoutStatus.SUCCESS,
        },
      });
    }

    return current;
  });

  await auditAccount(accountId, AuditAction.VAULT_WITHDRAWAL_SUCCEEDED, {
    entityType: "vault",
    entityId: vault.id,
    metadata: {
      amountLamports: amount.toString(),
      destination: walletAddress,
      txSignature,
    },
    context,
  });

  logger.info("Vault withdrawal confirmed", { accountId, amount: amount.toString(), signature: txSignature });

  return {
    message: "Withdrawal successful",
    signature: txSignature,
    amount: amount.toString(),
    vault: serializeVault(updated),
  };
}

/** Map RPC failure text to something a creator can act on. */
function describeTransferFailure(message: string): string {
  if (message.includes("insufficient") || message.includes("Attempt to debit")) {
    return "The platform wallet has insufficient SOL. Your vault balance is unchanged.";
  }
  if (message.includes("block height exceeded")) {
    return "The transaction expired before confirming. Your vault balance is unchanged — please try again.";
  }
  if (message.includes("unknown signer")) {
    return "Platform wallet is misconfigured. Your vault balance is unchanged.";
  }
  return "Withdrawal failed. Your vault balance is unchanged — please try again.";
}
