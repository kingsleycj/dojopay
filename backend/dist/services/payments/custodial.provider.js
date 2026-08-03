import { PayoutStatus } from "@prisma/client";
import { ESTIMATED_TX_FEE_LAMPORTS, TASK_PRICE_LAMPORTS } from "../../config/index.js";
import { getConnection, getPlatformWalletAddress } from "../../lib/solana.js";
import { requestPayout } from "../payout.service.js";
import { verifyFundingTransaction } from "../task.service.js";
/**
 * Current production behaviour, wrapped in the provider interface.
 *
 * Delegates to the existing services rather than duplicating them, so there is
 * still exactly one implementation of each rule. Once the escrow program is
 * deployed and `EscrowPaymentsProvider` lands, swapping providers is a config
 * change instead of a rewrite.
 */
export class CustodialPaymentsProvider {
    name = "custodial";
    async verifyTaskFunding(signature, creatorAddress) {
        await verifyFundingTransaction(signature, creatorAddress);
        return {
            amountLamports: BigInt(TASK_PRICE_LAMPORTS),
            // Null means "the platform wallet holds this task's funds".
            vaultAddress: null,
        };
    }
    async payoutWorker(request) {
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
        }
        catch (error) {
            return {
                healthy: false,
                detail: error instanceof Error ? error.message : "RPC unreachable",
            };
        }
    }
}
//# sourceMappingURL=custodial.provider.js.map