"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { buildVaultWithdrawalMessage, vaultEndpoints, type Vault } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { showToast } from "@/components/Toast";
import { PLATFORM_WALLET_ADDRESS } from "@/lib/solana/config";
import { lamportsToSol, solToLamports } from "@/utils/convert";

/**
 * The creator's vault: read, top up, withdraw.
 *
 * Topping up is a two-step operation and the split matters. The wallet transfer
 * is step one and is irreversible the moment it confirms; crediting the vault is
 * step two and is keyed on the transaction signature, which the backend stores
 * under a unique constraint.
 *
 * That split is what makes the failure mode recoverable: if the browser closes
 * between the two, the SOL is on chain and un-credited, and re-submitting the
 * same signature credits it exactly once. It is never lost, and it can never be
 * counted twice. `pendingSignature` below is what lets the UI offer that retry
 * rather than leaving the person to work it out.
 */
export function useVault() {
  const { account } = useAuth();
  const { publicKey, sendTransaction, signMessage } = useWallet();
  const { connection } = useConnection();
  const router = useRouter();

  const [vault, setVault] = useState<Vault | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"deposit" | "withdraw" | null>(null);

  /**
   * A confirmed transfer whose credit call did not complete. Held so the UI can
   * offer "retry crediting" instead of the person believing the SOL is gone.
   */
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setVault(await vaultEndpoints.summary());
    } catch {
      setVault(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Credit a transfer that is already confirmed on chain. Safe to retry. */
  const credit = useCallback(
    async (signature: string) => {
      const result = await vaultEndpoints.deposit(signature);
      setVault(result.vault);
      setPendingSignature(null);
      return result;
    },
    [],
  );

  const deposit = useCallback(
    async (solAmount: string) => {
      if (busy) return;

      if (!account?.walletAddress) {
        showToast("Connect a wallet before topping up — taking you to settings", "info");
        router.push("/settings");
        return;
      }

      if (!publicKey || !sendTransaction) {
        showToast("Unlock your wallet to send the top-up", "error");
        return;
      }

      // The deposit must come from the linked wallet: the backend checks the fee
      // payer against it, so a transfer from a different connected wallet would
      // confirm on chain and then be refused.
      if (publicKey.toBase58() !== account.walletAddress) {
        showToast(
          "Your connected wallet is not the one linked to this account. Switch wallets and try again.",
          "error",
        );
        return;
      }

      const lamports = solToLamports(solAmount);
      if (!Number.isFinite(lamports) || lamports <= 0) {
        showToast("Enter an amount to top up", "error");
        return;
      }

      setBusy("deposit");
      let signature: string | null = null;

      try {
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(PLATFORM_WALLET_ADDRESS),
            lamports,
          }),
        );

        const {
          context: { slot: minContextSlot },
          value: { blockhash, lastValidBlockHeight },
        } = await connection.getLatestBlockhashAndContext();

        signature = await sendTransaction(transaction, connection, { minContextSlot });

        const confirmation = await connection.confirmTransaction({
          blockhash,
          lastValidBlockHeight,
          signature,
        });

        if (confirmation.value.err) {
          throw new Error("The transfer failed on chain. Nothing was moved.");
        }

        // From here the SOL has left the wallet. Anything that goes wrong below
        // is a crediting problem, not a lost-funds problem.
        setPendingSignature(signature);
        const result = await credit(signature);

        showToast(`Topped up ${lamportsToSol(String(lamports), 4)} SOL`, "success");
        return result;
      } catch (error: any) {
        if (error?.name === "WalletSendTransactionError" || /reject|denied|cancel/i.test(error?.message ?? "")) {
          showToast("Top-up cancelled", "info");
          setPendingSignature(null);
          return;
        }

        if (signature) {
          showToast(
            "Your SOL was sent but crediting it did not complete. It is safe — use “Retry crediting” below.",
            "error",
          );
        } else {
          showToast(error?.message ?? "Top-up failed. Please try again.", "error");
        }
      } finally {
        setBusy(null);
      }
    },
    [account?.walletAddress, busy, connection, credit, publicKey, router, sendTransaction],
  );

  const retryCredit = useCallback(async () => {
    if (!pendingSignature || busy) return;

    setBusy("deposit");
    try {
      await credit(pendingSignature);
      showToast("Top-up credited", "success");
    } catch (error: any) {
      showToast(error?.message ?? "Could not credit that transfer", "error");
    } finally {
      setBusy(null);
    }
  }, [busy, credit, pendingSignature]);

  const withdraw = useCallback(async () => {
    if (busy || !vault) return;

    if (!account?.walletAddress) {
      showToast("Connect a wallet to withdraw — taking you to settings", "info");
      router.push("/settings");
      return;
    }

    if (!publicKey || !signMessage) {
      showToast("Unlock your wallet to sign the withdrawal", "error");
      return;
    }

    if (publicKey.toBase58() !== account.walletAddress) {
      showToast("Your connected wallet is not the one linked to this account.", "error");
      return;
    }

    // The server withdraws the whole available balance and signs that exact
    // number, so the message has to be built from `available` — not from
    // `withdrawable`, which is zeroed below the minimum for display purposes.
    if (BigInt(vault.withdrawable) <= BigInt(0)) {
      showToast(
        `You need at least ${lamportsToSol(vault.minimumWithdrawal, 4)} SOL available to withdraw`,
        "error",
      );
      return;
    }

    setBusy("withdraw");
    try {
      const message = new TextEncoder().encode(
        buildVaultWithdrawalMessage(vault.available, account.walletAddress),
      );
      const signature = await signMessage(message);
      const result = await vaultEndpoints.withdraw(Array.from(signature));

      setVault(result.vault);
      showToast(
        `Withdrew ${lamportsToSol(result.amount, 4)} SOL — ${result.signature.slice(0, 8)}…`,
        "success",
      );
    } catch (error: any) {
      if (error?.name === "WalletSignMessageError" || /reject|denied/i.test(error?.message ?? "")) {
        showToast("Withdrawal cancelled", "info");
        return;
      }

      // The balance moved between the read and the signature — a task funded in
      // another tab, most likely. Re-reading gives the user a correct number to
      // retry against.
      if (error?.code === "BALANCE_CHANGED") {
        await refresh();
        showToast("Your balance changed. Check the new amount and try again.", "error");
        return;
      }

      showToast(error?.message ?? "Withdrawal failed. Please try again.", "error");
    } finally {
      setBusy(null);
    }
  }, [account?.walletAddress, busy, publicKey, refresh, router, signMessage, vault]);

  return {
    vault,
    loading,
    busy,
    pendingSignature,
    refresh,
    deposit,
    retryCredit,
    withdraw,
  };
}
