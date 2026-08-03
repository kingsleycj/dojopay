import "dotenv/config";

/**
 * Single source of truth for configuration.
 *
 * This module must not import anything else from `src/` — the previous layout
 * derived the worker JWT secret from a default import of `index.ts`, which
 * actually exports the Express app. The secret was therefore Express's own
 * source text, making worker tokens forgeable. Keeping this module a leaf
 * makes that class of mistake impossible.
 */

const isTest = process.env.NODE_ENV === "test";

function required(name: string): string {
  const value = process.env[name];
  if (value && value.trim() !== "") return value;

  // Tests supply their own values via vitest.config.ts. Everywhere else a
  // missing secret is fatal: booting with a fallback secret is how the old
  // code shipped `"fallback-secret-for-dev"` to production.
  if (isTest) return `test-${name}`;

  throw new Error(
    `Missing required environment variable ${name}. ` +
      `Set it before starting the server — see CLAUDE.md §6.`,
  );
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : fallback;
}

/** Lamports in one SOL. */
export const LAMPORTS_PER_SOL = 1_000_000_000;

/** Price a creator pays to fund one task. */
export const TASK_PRICE_LAMPORTS = 100_000_000; // 0.1 SOL

/**
 * A task accepts this many submissions before it closes. The worker reward is
 * `task.amount / MAX_SUBMISSIONS_PER_TASK`, so this cap is what bounds total
 * payout to the amount actually funded. It was never enforced before Phase 3.
 */
export const MAX_SUBMISSIONS_PER_TASK = 100;

/** Reward per accepted submission, in lamports. */
export const REWARD_PER_SUBMISSION_LAMPORTS = BigInt(TASK_PRICE_LAMPORTS) / BigInt(MAX_SUBMISSIONS_PER_TASK);

/**
 * Withdrawals below this are refused: a Solana transfer costs ~5000 lamports in
 * fees, so paying out dust loses the platform money and wastes the worker's time.
 */
export const MIN_WITHDRAWAL_LAMPORTS = 1_000_000n; // 0.001 SOL

/** Estimated network fee used when checking the platform wallet can cover a payout. */
export const ESTIMATED_TX_FEE_LAMPORTS = 5_000;

export const config = {
  env: optional("NODE_ENV", "development"),
  isProduction: process.env.NODE_ENV === "production",
  isTest,
  port: Number(optional("PORT", "3000")),

  database: {
    url: required("DATABASE_URL"),
  },

  auth: {
    /**
     * Signs account sessions.
     *
     * One token per person, not per role. Before accounts existed there were
     * two secrets, one for creator tokens and one for worker tokens; with an
     * `Account` owning both profiles that split is meaningless — a user who
     * signs in with Google would otherwise have to sign in twice to switch
     * modes. Role authorisation is now a profile lookup, not a second login.
     */
    jwtSecret: required("JWT_SECRET"),
    /** Session lifetime. */
    tokenTtl: "7d",

    /**
     * Signs admin sessions. A completely separate secret from the user one, so
     * a stolen or forged user token can never satisfy an admin check even if
     * the role logic has a bug.
     */
    adminJwtSecret: required("ADMIN_JWT_SECRET"),
    /** Admin sessions are short: staff tooling reads everyone's data. */
    adminTokenTtl: "8h",

    /** Message a wallet signs to prove ownership at sign-in or when linking. */
    walletChallengePrefix: "Sign in to DojoPay",

    /** How long an email verification or password reset link stays valid. */
    emailTokenTtlMinutes: 60,
  },

  mail: {
    /** Unset falls back to the console driver, which logs links instead of sending. */
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    from: optional("MAIL_FROM", "DojoPay <onboarding@resend.dev>"),
    /** Base URL used to build links in emails. */
    appUrl: optional("FRONTEND_URL", "http://localhost:5174"),
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    /** Must match the redirect URI registered in the Google console exactly. */
    callbackUrl: optional(
      "GOOGLE_CALLBACK_URL",
      "http://localhost:3000/v1/auth/google/callback",
    ),
    /** Google login is simply unavailable, rather than broken, when unconfigured. */
    get enabled(): boolean {
      return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    },
  },

  solana: {
    /** Honour an explicit RPC endpoint; the old code hardcoded devnet. */
    rpcUrl: optional("RPC_URL", "https://api.devnet.solana.com"),
    cluster: optional("SOLANA_CLUSTER", "devnet"),
    /**
     * A just-confirmed transaction takes a moment to become queryable by
     * signature, so funding lookups retry with linear backoff. Zero delay under
     * test so the suite does not sleep for 30 seconds.
     */
    txLookupAttempts: 5,
    txLookupBaseDelayMs: isTest ? 0 : 2000,
    /**
     * Wallet that receives task funding and pays workers out. Was hardcoded in
     * two separate files, which meant rotating it required a code change.
     */
    platformWalletAddress: required("PLATFORM_WALLET_ADDRESS"),
    /** base58 secret key for the platform wallet. Signing key — never log this. */
    platformWalletPrivateKey: required("PRIVATE_KEY"),
  },

  s3: {
    bucket: required("S3_BUCKET_NAME"),
    region: optional("S3_BUCKET_REGION", "us-east-1"),
    accessKeyId: required("S3_BUCKET_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_BUCKET_SECRET_ACCESS_KEY"),
    cloudfrontUrl: optional("CLOUDFRONT_URL", "https://d1vs1llhujzng9.cloudfront.net/"),
  },

  cors: {
    allowedOrigins: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:5173",
      "http://localhost:5174",
      "https://dojopay.vercel.app",
      process.env.FRONTEND_URL,
    ].filter((origin): origin is string => Boolean(origin)),
  },
} as const;

/**
 * Fail fast at boot rather than at the first request that needs a missing value.
 * Called from the server bootstrap; importing this module alone does not validate,
 * so tests can import constants without a full environment.
 */
export function assertConfigValid(): void {
  if (config.auth.jwtSecret === config.auth.adminJwtSecret) {
    throw new Error(
      "JWT_SECRET and ADMIN_JWT_SECRET must differ — sharing one secret would let " +
        "any user token be replayed against the admin API.",
    );
  }

  if (config.isProduction && !config.mail.resendApiKey) {
    throw new Error(
      "RESEND_API_KEY is required in production: without it verification and " +
        "password-reset links are only written to the server log, so nobody can " +
        "verify an address or recover an account.",
    );
  }
}
