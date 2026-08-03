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
