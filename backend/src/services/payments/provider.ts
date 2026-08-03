import type { PayoutStatus } from "@prisma/client";

/**
 * The seam between "how DojoPay holds money" and "everything else".
 *
 * Two implementations exist during the migration:
 *
 *  - `CustodialPaymentsProvider` — the platform hot wallet pays workers. This is
 *    what runs today. Its weakness is structural, not fixable in code: one
 *    private key in an environment variable controls every open task's funds.
 *
 *  - `EscrowPaymentsProvider` — the on-chain program in `escrow/` holds each
 *    task's funds in a PDA and workers claim directly from it. The backend
 *    signs as *attester* (this worker did the work) but never has custody and
 *    cannot redirect funds.
 *
 * Tasks record which model funded them: `Task.vaultAddress` is null for
 * custodial tasks and set for escrowed ones. That lets both coexist while open
 * custodial tasks drain naturally, rather than requiring a flag day.
 */

export interface PayoutRequest {
  workerId: number;
  workerAddress: string;
  amountLamports: bigint;
  /** Wallet signature authorising this specific amount and destination. */
  authorization: unknown;
}

export interface PayoutResult {
  signature: string;
  amountLamports: bigint;
  status: PayoutStatus;
}

export interface FundingVerification {
  /** Lamports confirmed as having arrived. */
  amountLamports: bigint;
  /** PDA holding the funds, or null when the platform wallet holds them. */
  vaultAddress: string | null;
}

export interface PaymentsProvider {
  readonly name: "custodial" | "escrow";

  /**
   * Confirm on chain that a creator's top-up landed, and for how much.
   *
   * Used to be `verifyTaskFunding`, checking a fixed 0.1 SOL per task. Creators
   * now top a vault up by an amount they choose and fund tasks from it, so the
   * on-chain step is a deposit and the amount is an output rather than an
   * assertion. Implementations must reject replays: a signature that has already
   * been credited cannot be credited again.
   */
  verifyDeposit(signature: string, depositorAddress: string): Promise<FundingVerification>;

  /**
   * Move a worker's earned balance to their wallet.
   *
   * Implementations must debit before broadcasting and restore the balance if
   * the transfer fails — a retry must never pay twice.
   */
  payoutWorker(request: PayoutRequest): Promise<PayoutResult>;

  /** Whether the provider can currently settle payouts (funds, keys, RPC). */
  healthCheck(): Promise<{ healthy: boolean; detail?: string }>;
}
