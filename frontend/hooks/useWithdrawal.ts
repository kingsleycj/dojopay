"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { buildWithdrawalMessage, workerEndpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { showToast } from "@/components/Toast";
import { lamportsToSol } from "@/utils/convert";

/**
 * Worker withdrawal.
 *
 * Two gates, in order:
 *  1. **A linked wallet.** An account can sign up with only an email, so there
 *     may be nowhere to send SOL. Rather than surfacing the backend's 403, this
 *     sends the user to settings, which is where the problem is fixable.
 *  2. **A wallet signature** over `Withdraw <lamports> to <address>`, which the
 *     backend verifies. The earnings page used to POST an empty body and
 *     therefore always failed; both entry points now share this hook.
 */
export function useWithdrawal(onSuccess?: () => void | Promise<void>) {
  const { publicKey, signMessage } = useWallet();
  const { account } = useAuth();
  const router = useRouter();
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const withdraw = useCallback(
    async (pendingLamports: string) => {
      if (isWithdrawing) return;

      if (!account?.walletAddress) {
        showToast("Connect a wallet to withdraw — taking you to settings", "info");
        router.push("/settings");
        return;
      }

      if (!publicKey || !signMessage) {
        showToast("Unlock your wallet to sign the withdrawal", "error");
        return;
      }

      // The linked wallet is the destination, so signing with a different
      // connected wallet would produce a signature the backend cannot verify.
      if (publicKey.toBase58() !== account.walletAddress) {
        showToast(
          "Your connected wallet is not the one linked to this account. Switch wallets and try again.",
          "error",
        );
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
          buildWithdrawalMessage(pendingLamports, account.walletAddress),
        );
        const signature = await signMessage(message);

        const result = await workerEndpoints.payout(Array.from(signature));

        showToast(
          `Withdrew ${lamportsToSol(result.amount)} SOL — ${result.signature.slice(0, 8)}…`,
          "success",
        );
        await onSuccess?.();
      } catch (error: any) {
        // Dismissing the wallet prompt is a cancellation, not a failure.
        if (error?.name === "WalletSignMessageError" || /reject|denied/i.test(error?.message ?? "")) {
          showToast("Withdrawal cancelled", "info");
          return;
        }

        if (error?.code === "WALLET_REQUIRED") {
          router.push("/settings");
          return;
        }

        showToast(error?.message ?? "Withdrawal failed. Please try again.", "error");
      } finally {
        setIsWithdrawing(false);
      }
    },
    [account?.walletAddress, publicKey, signMessage, isWithdrawing, onSuccess, router],
  );

  return { withdraw, isWithdrawing, canWithdraw: Boolean(account?.walletAddress) };
}
