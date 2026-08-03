import nacl from "tweetnacl";
import { PayoutStatus } from "@prisma/client";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { ESTIMATED_TX_FEE_LAMPORTS, MIN_WITHDRAWAL_LAMPORTS } from "../config/index.js";
import { prismaClient } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { getConnection, getPlatformKeypair, getPlatformWalletAddress, toSignatureBytes } from "../lib/solana.js";
import { badRequest, notFound, serverError, unauthorized } from "../utils/errors.js";

/**
 * Worker withdrawals.
 *
 * The custodial path: the platform wallet holds task funds and transfers SOL to
 * the worker. Phase 6 replaces this with an on-chain escrow program, at which
 * point this module becomes one implementation behind a `PaymentsProvider`
 * interface rather than the only way money moves.
 *
 * Two properties this must hold that the previous version did not:
 *
 *  1. **Debit before send.** The worker's pending balance is moved to a
 *     reserved state *before* the transfer is broadcast. The old code sent
 *     first and debited after, so two concurrent requests could both read the
 *     same balance and both pay out.
 *
 *  2. **Honest terminal state.** A payout row ends as SUCCESS or FAILED, and a
 *     failure restores the worker's balance. The old code wrote PROCESSING and
 *     never updated it, so paid work never displayed as paid.
 */

export function buildWithdrawalMessage(lamports: bigint, address: string): string {
  return `Withdraw ${lamports} lamports to ${address}`;
}

function verifyWithdrawalSignature(worker: { address: string }, lamports: bigint, signature: unknown) {
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = toSignatureBytes(signature);
  } catch {
    throw badRequest("Invalid signature format", "INVALID_SIGNATURE_FORMAT");
  }

  const message = new TextEncoder().encode(buildWithdrawalMessage(lamports, worker.address));
  const verified = nacl.sign.detached.verify(
    message,
    signatureBytes,
    new PublicKey(worker.address).toBytes(),
  );

  if (!verified) throw unauthorized("Invalid withdrawal signature", "INVALID_SIGNATURE");
}

export async function requestPayout(workerId: number, signature: unknown) {
  const worker = await prismaClient.worker.findUnique({ where: { id: workerId } });
  if (!worker) throw notFound("Worker not found", "WORKER_NOT_FOUND");

  const amount = worker.pending_amount;

  if (amount <= 0n) {
    throw badRequest("No pending earnings to withdraw", "NO_PENDING_EARNINGS");
  }

  if (amount < MIN_WITHDRAWAL_LAMPORTS) {
    throw badRequest(
      `Minimum withdrawal is ${MIN_WITHDRAWAL_LAMPORTS} lamports; you have ${amount}`,
      "BELOW_MINIMUM",
      { minimum: MIN_WITHDRAWAL_LAMPORTS.toString(), available: amount.toString() },
    );
  }

  // The worker signs the exact amount, so a signature captured from one
  // withdrawal cannot authorise a later, larger one.
  verifyWithdrawalSignature(worker, amount, signature);

  const connection = getConnection();
  const platformWallet = getPlatformWalletAddress();

  const balance = await connection.getBalance(platformWallet);
  const needed = Number(amount) + ESTIMATED_TX_FEE_LAMPORTS;

  if (balance < needed) {
    logger.error("Platform wallet underfunded", { balance, needed });
    throw serverError(
      "The platform wallet is temporarily unable to cover withdrawals. Please try again shortly.",
      "INSUFFICIENT_PLATFORM_FUNDS",
    );
  }

  // Reserve the funds first. If the transfer then fails we put them back.
  const debited = await prismaClient.worker.updateMany({
    where: { id: workerId, pending_amount: amount },
    data: { pending_amount: 0n },
  });

  if (debited.count === 0) {
    // Balance moved between read and debit — a concurrent withdrawal or a new
    // submission landing. The client should re-read and retry.
    throw badRequest("Your balance changed, please retry the withdrawal", "BALANCE_CHANGED");
  }

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
        toPubkey: new PublicKey(worker.address),
        lamports: Number(amount),
      }),
    );

    txSignature = await sendAndConfirmTransaction(connection, transaction, [keypair], {
      commitment: "confirmed",
    });
  } catch (error) {
    // Restore the reservation; the worker keeps their earnings.
    await prismaClient.worker.update({
      where: { id: workerId },
      data: { pending_amount: { increment: amount } },
    });

    const message = error instanceof Error ? error.message : String(error);
    logger.error("Payout transfer failed", { workerId, amount, error: message });

    await prismaClient.payouts.create({
      data: {
        worker_id: workerId,
        amount,
        // No on-chain signature exists; synthesise a unique marker so the
        // failure is still recorded under the unique constraint.
        signature: `failed-${workerId}-${Date.now()}`,
        status: PayoutStatus.FAILED,
      },
    });

    throw serverError(describeTransferFailure(message), "PAYOUT_FAILED");
  }

  // Transfer confirmed. Record it and move the amount into the withdrawn total.
  await prismaClient.$transaction(async (tx) => {
    await tx.worker.update({
      where: { id: workerId },
      data: { withdrawn_amount: { increment: amount } },
    });

    await tx.payouts.create({
      data: {
        worker_id: workerId,
        amount,
        signature: txSignature,
        status: PayoutStatus.SUCCESS,
      },
    });
  });

  logger.info("Payout confirmed", { workerId, amount, signature: txSignature });

  return {
    message: "Withdrawal successful",
    signature: txSignature,
    amount: amount.toString(),
  };
}

/** Map RPC failure text to something a worker can act on. */
function describeTransferFailure(message: string): string {
  if (message.includes("insufficient") || message.includes("Attempt to debit")) {
    return "The platform wallet has insufficient SOL. Your balance is unchanged.";
  }
  if (message.includes("block height exceeded")) {
    return "The transaction expired before confirming. Your balance is unchanged — please try again.";
  }
  if (message.includes("unknown signer")) {
    return "Platform wallet is misconfigured. Your balance is unchanged.";
  }
  return "Withdrawal failed. Your balance is unchanged — please try again.";
}

export async function listWorkerPayouts(workerId: number) {
  const payouts = await prismaClient.payouts.findMany({
    where: { worker_id: workerId },
    orderBy: { createdAt: "desc" },
  });

  return payouts.map((payout) => ({
    id: payout.id,
    worker_id: payout.worker_id,
    amount: payout.amount.toString(),
    signature: payout.signature,
    status: payout.status,
    created_at: payout.createdAt.toISOString(),
  }));
}
