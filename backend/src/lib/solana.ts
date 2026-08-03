import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { config } from "../config/index.js";

/**
 * Solana access. One `Connection` for the whole process, pointed at `RPC_URL`
 * — the old code called `clusterApiUrl("devnet")` in two separate routers, so
 * the configured Helius endpoint was silently ignored and every request hit the
 * heavily rate-limited public endpoint.
 */

let connection: Connection | null = null;

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(config.solana.rpcUrl, "confirmed");
  }
  return connection;
}

export function getPlatformWalletAddress(): PublicKey {
  return new PublicKey(config.solana.platformWalletAddress);
}

/**
 * Signing keypair for the platform wallet.
 *
 * Built lazily so that importing this module (as the tests do) does not require
 * a valid key, and verified against the configured address so a mismatched
 * `PRIVATE_KEY`/`PLATFORM_WALLET_ADDRESS` pair fails loudly at first use rather
 * than producing an "unknown signer" error deep inside a payout.
 */
let platformKeypair: Keypair | null = null;

export function getPlatformKeypair(): Keypair {
  if (!platformKeypair) {
    const decoded = bs58.decode(config.solana.platformWalletPrivateKey);
    const keypair = Keypair.fromSecretKey(decoded);

    if (keypair.publicKey.toString() !== config.solana.platformWalletAddress) {
      throw new Error(
        "PRIVATE_KEY does not correspond to PLATFORM_WALLET_ADDRESS — refusing to sign.",
      );
    }
    platformKeypair = keypair;
  }
  return platformKeypair;
}

/**
 * Verify an ed25519 signature produced by a wallet's `signMessage`.
 *
 * Wallet adapters hand back several shapes depending on version and transport
 * (Uint8Array, plain array, `{data: [...]}` from JSON round-tripping, or base64).
 * Normalising here keeps that mess out of the auth service.
 */
export function toSignatureBytes(signature: unknown): Uint8Array {
  if (signature instanceof Uint8Array) return signature;

  if (Array.isArray(signature)) return new Uint8Array(signature);

  if (typeof signature === "string") {
    return Uint8Array.from(Buffer.from(signature, "base64"));
  }

  if (signature && typeof signature === "object" && "data" in signature) {
    const data = (signature as { data: unknown }).data;
    if (Array.isArray(data)) return new Uint8Array(data);
  }

  throw new Error("Unrecognised signature format");
}

/**
 * Fetch a transaction by signature, retrying while it becomes queryable.
 *
 * A just-confirmed transaction is not immediately available by signature, so a
 * single lookup returns null for a payment the user watched succeed.
 */
export async function fetchTransaction(signature: string) {
  const { txLookupAttempts, txLookupBaseDelayMs } = config.solana;

  for (let attempt = 0; attempt <= txLookupAttempts; attempt++) {
    const transaction = await getConnection().getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    if (transaction) return transaction;

    if (attempt < txLookupAttempts && txLookupBaseDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * txLookupBaseDelayMs));
    }
  }
  return null;
}

/** Why a transfer was not accepted. Each maps to a distinct user-facing message. */
export type TransferRejection =
  | "TX_NOT_FOUND"
  | "TX_FAILED"
  | "WRONG_RECIPIENT"
  | "WRONG_PAYER";

/**
 * A flat result rather than a discriminated union.
 *
 * This project compiles with `strict: false`, under which narrowing an
 * `{ok: true} | {ok: false}` union does not reliably work — the compiler
 * rejects every field access on both branches. A single shape with a nullable
 * `rejection` needs no narrowing to read correctly, which matters more here
 * than the tidier union would.
 */
export interface IncomingTransfer {
  /** Null when the transfer was accepted. */
  rejection: TransferRejection | null;
  /** Lamports the platform wallet gained. Zero on rejection. */
  lamports: bigint;
  /** Fee payer, i.e. who sent it. Empty on rejection. */
  payer: string;
}

/**
 * Confirm on chain that `signature` moved SOL into the platform wallet, and
 * report how much and from whom.
 *
 * Deliberately returns the amount rather than checking it: deposits are for an
 * amount the creator chooses, so "how much arrived" is the answer the caller
 * needs, and only the caller knows what it should have been. What is *not*
 * negotiable and is checked here: the transaction exists, it **succeeded**, and
 * the platform wallet is a party to it. Skipping the `meta.err` check is how a
 * failed transaction could once fund a task.
 */
export async function verifyIncomingTransfer(
  signature: string,
  expectedPayer?: string,
): Promise<IncomingTransfer> {
  const reject = (rejection: TransferRejection, payer = ""): IncomingTransfer => ({
    rejection,
    lamports: 0n,
    payer,
  });

  const transaction = await fetchTransaction(signature);
  if (!transaction) return reject("TX_NOT_FOUND");
  if (transaction.meta?.err) return reject("TX_FAILED");

  const accountKeys = transaction.transaction.message.getAccountKeys();
  const platformAddress = config.solana.platformWalletAddress;

  let platformIndex = -1;
  for (let i = 0; i < accountKeys.length; i++) {
    if (accountKeys.get(i)?.toString() === platformAddress) {
      platformIndex = i;
      break;
    }
  }
  if (platformIndex === -1) return reject("WRONG_RECIPIENT");

  const preBalances = transaction.meta?.preBalances ?? [];
  const postBalances = transaction.meta?.postBalances ?? [];
  const credited = BigInt(postBalances[platformIndex] ?? 0) - BigInt(preBalances[platformIndex] ?? 0);

  // Account key 0 is the fee payer, i.e. whoever actually sent the SOL.
  const payer = accountKeys.get(0)?.toString() ?? "";
  if (expectedPayer && payer !== expectedPayer) return reject("WRONG_PAYER", payer);

  return { rejection: null, lamports: credited, payer };
}

/** True when the string is a well-formed base58 Solana public key. */
export function isValidPublicKey(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

/** Reset cached handles. Test-only. */
export function __resetSolanaCaches(): void {
  connection = null;
  platformKeypair = null;
}
