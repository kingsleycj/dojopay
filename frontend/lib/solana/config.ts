import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl } from "@solana/web3.js";

/**
 * The single place that decides which Solana cluster the app talks to.
 *
 * Previously `app/layout.tsx` selected Devnet while `app/(root)/layout.tsx`
 * selected **Mainnet**, so a task funded on one network was invisible on the
 * other depending on which layout had rendered.
 */

function resolveNetwork(): WalletAdapterNetwork {
  switch (process.env.NEXT_PUBLIC_SOLANA_NETWORK) {
    case "mainnet-beta":
      return WalletAdapterNetwork.Mainnet;
    case "testnet":
      return WalletAdapterNetwork.Testnet;
    default:
      return WalletAdapterNetwork.Devnet;
  }
}

export const SOLANA_NETWORK = resolveNetwork();

/** Custom RPC endpoint if configured, otherwise the public cluster endpoint. */
export const SOLANA_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl(SOLANA_NETWORK);

/** Wallet that receives task funding. Must match the backend's PLATFORM_WALLET_ADDRESS. */
export const PLATFORM_WALLET_ADDRESS =
  process.env.NEXT_PUBLIC_PLATFORM_WALLET_ADDRESS ||
  "FPDb9L6L3kyBiw8LeXCcdza85PbSNxcZujXNkPrwEont";

/**
 * Task economics, mirroring `backend/src/config/index.ts`.
 *
 * These bound what the composer will let a creator ask for, so the form can
 * reject an impossible combination before a round-trip. They are *not* the
 * authority: the server re-validates every one of them and computes the actual
 * reward, so a stale copy here can only ever be over-permissive in the UI, never
 * wrong in the ledger.
 */
export const TASK_PRICE_LAMPORTS = 100_000_000;
export const DEFAULT_SUBMISSIONS_PER_TASK = 100;

export const MIN_TASK_BUDGET_LAMPORTS = 10_000_000;
export const MAX_TASK_BUDGET_LAMPORTS = 1_000_000_000_000;
export const MIN_SUBMISSIONS_PER_TASK = 5;
export const MAX_SUBMISSIONS_PER_TASK = 1000;
export const MIN_REWARD_PER_SUBMISSION_LAMPORTS = 100_000;
export const MIN_DEPOSIT_LAMPORTS = 10_000_000;

/** Explorer link for a transaction signature on the active cluster. */
export function explorerTxUrl(signature: string): string {
  const cluster = SOLANA_NETWORK === WalletAdapterNetwork.Mainnet ? "" : `?cluster=${SOLANA_NETWORK}`;
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
}
