"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { buildWithdrawalMessage, workerEndpoints } from "@/lib/api";
import { showToast } from "@/components/Toast";
import { lamportsToSol } from "@/utils/convert";

/**
 * Worker withdrawal.
 *
 * The backend requires a wallet signature over
 * `Withdraw <lamports> to <address>`; the earnings page used to POST an empty
 * body and therefore always got a 400 back. Both entry points now share this
 * hook, so the flow cannot drift apart again.
 */
export function useWithdrawal(onSuccess?: () => void | Promise<void>) {
  const { publicKey, signMessage } = useWallet();
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const withdraw = useCallback(
    async (pendingLamports: string) => {
      if (isWithdrawing) return;

      if (!publicKey || !signMessage) {
        showToast("Connect your wallet to withdraw", "error");
        return;
      }

      // `BigInt(0)` rather than the `0n` literal so this file does not depend
      // on the compile target.
      if (!pendingLamports || BigInt(pendingLamports) <= BigInt(0)) {
        showToast("No earnings available to withdraw", "error");
        return;
      }

      setIsWithdrawing(true);
      try {
        const message = new TextEncoder().encode(
          buildWithdrawalMessage(pendingLamports, publicKey.toBase58()),
        );
        const signature = await signMessage(message);

        const result = await workerEndpoints.payout(Array.from(signature));

        showToast(
          `Withdrew ${lamportsToSol(result.amount)} SOL — ${result.signature.slice(0, 8)}…`,
          "success",
        );
        await onSuccess?.();
      } catch (error: any) {
        // A user dismissing the wallet prompt is a cancellation, not a failure.
        if (error?.name === "WalletSignMessageError" || /reject|denied/i.test(error?.message ?? "")) {
          showToast("Withdrawal cancelled", "info");
        } else {
          showToast(error?.message ?? "Withdrawal failed. Please try again.", "error");
        }
      } finally {
        setIsWithdrawing(false);
      }
    },
    [publicKey, signMessage, isWithdrawing, onSuccess],
  );

  return { withdraw, isWithdrawing };
}
