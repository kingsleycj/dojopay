import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 10000,
    hookTimeout: 10000,
    include: ["tests/**/*.test.ts", "tests/**/*.spec.ts"],
    exclude: ["node_modules", "dist"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/dojopay_test",
      JWT_SECRET: "test-account-secret",
      ADMIN_JWT_SECRET: "test-admin-secret",
      RPC_URL: "https://api.devnet.solana.com",
      // Valid base58 pubkey so PublicKey construction succeeds in tests.
      PLATFORM_WALLET_ADDRESS: "FPDb9L6L3kyBiw8LeXCcdza85PbSNxcZujXNkPrwEont",
      PRIVATE_KEY: "test-private-key",
      S3_BUCKET_NAME: "test-bucket",
      S3_BUCKET_REGION: "us-east-1",
      S3_BUCKET_ACCESS_KEY_ID: "test-key-id",
      S3_BUCKET_SECRET_ACCESS_KEY: "test-secret",
    },
  },
});
