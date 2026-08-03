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

/** Price to create one task, in lamports. Mirrors the backend constant. */
export const TASK_PRICE_LAMPORTS = 100_000_000;

/** Submissions a task accepts before closing. Mirrors the backend constant. */
export const MAX_SUBMISSIONS_PER_TASK = 100;

/** Explorer link for a transaction signature on the active cluster. */
export function explorerTxUrl(signature: string): string {
  const cluster = SOLANA_NETWORK === WalletAdapterNetwork.Mainnet ? "" : `?cluster=${SOLANA_NETWORK}`;
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
}
