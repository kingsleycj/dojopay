import { PayoutStatus } from "@prisma/client";
import { ESTIMATED_TX_FEE_LAMPORTS } from "../../config/index.js";
import {
  getConnection,
  getPlatformWalletAddress,
  verifyIncomingTransfer,
} from "../../lib/solana.js";
import { badRequest } from "../../utils/errors.js";
import { requestPayout } from "../payout.service.js";
import type {
  FundingVerification,
  PaymentsProvider,
  PayoutRequest,
  PayoutResult,
} from "./provider.js";

/**
 * Current production behaviour, wrapped in the provider interface.
 *
 * Delegates to the existing services rather than duplicating them, so there is
 * still exactly one implementation of each rule. Once the escrow program is
 * deployed and `EscrowPaymentsProvider` lands, swapping providers is a config
 * change instead of a rewrite.
 */
export class CustodialPaymentsProvider implements PaymentsProvider {
  readonly name = "custodial" as const;

  async verifyDeposit(
    signature: string,
    depositorAddress: string,
  ): Promise<FundingVerification> {
    const result = await verifyIncomingTransfer(signature, depositorAddress);

    if (result.rejection) {
      throw badRequest("That deposit could not be confirmed on chain", result.rejection);
    }

    return {
      amountLamports: result.lamports,
      // Null means "the platform wallet holds these funds" — which, under the
      // custodial model, it does. Replay rejection lives on the unique
      // `VaultEntry.signature`, where the credit is actually recorded.
      vaultAddress: null,
    };
  }

  async payoutWorker(request: PayoutRequest): Promise<PayoutResult> {
    const result = await requestPayout(request.workerId, request.authorization);
    return {
      signature: result.signature,
      amountLamports: BigInt(result.amount),
      status: PayoutStatus.SUCCESS,
    };
  }

  /**
   * The custodial model's core operational risk: if the hot wallet runs dry,
   * every worker's withdrawal fails even though their balance is real.
   */
  async healthCheck() {
    try {
      const balance = await getConnection().getBalance(getPlatformWalletAddress());

      if (balance < ESTIMATED_TX_FEE_LAMPORTS * 10) {
        return {
          healthy: false,
          detail: `Platform wallet critically low: ${balance} lamports`,
        };
      }
      return { healthy: true, detail: `Platform wallet balance ${balance} lamports` };
    } catch (error) {
      return {
        healthy: false,
        detail: error instanceof Error ? error.message : "RPC unreachable",
      };
    }
  }
}
