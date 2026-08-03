/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE: `port` and `devServer` used to be set here. Neither is a Next.js
  // config key — Next logged "Unrecognized key(s) in object: 'port',
  // 'devServer'" and ignored them both. The port comes from `next dev -p 5174`
  // in package.json.

  /**
   * Barrel-file optimisation for the production bundle.
   *
   * Measured honestly: this does **not** fix slow dev compiles. Cold first
   * compile of `/` went 39.7s → 36.4s, which is noise. Kept because it still
   * trims the shipped bundle, but the real cost is structural — see below.
   */
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@solana/wallet-adapter-react",
      "@solana/wallet-adapter-react-ui",
      "@solana/wallet-adapter-wallets",
      "recharts",
      "date-fns",
    ],
  },

  webpack: (config, { dev }) => {
    if (dev) {
      /**
       * The actual cause of `ChunkLoadError: Loading chunk app/layout failed
       * (timeout)`.
       *
       * `app/layout.tsx` mounts the Solana wallet providers, so **every** route
       * — including the marketing page, which needs no wallet — compiles the
       * whole adapter tree: ~9,300 modules, ~36s on a cold `.next`. If the
       * browser requests a chunk while that is still running, webpack's default
       * 120s ceiling can be exceeded by a queued compile and the load is
       * abandoned.
       *
       * Raising the ceiling in development stops a slow first compile
       * presenting as a hard error. It changes nothing in production, where
       * chunks are prebuilt and served in milliseconds.
       *
       * The structural fix is to mount the wallet providers only on routes that
       * need them rather than at the root. That is a larger change and is noted
       * in CLAUDE.md rather than done here.
       */
      config.output = { ...config.output, chunkLoadTimeout: 600_000 };
    }
    return config;
  },
};

module.exports = nextConfig;
