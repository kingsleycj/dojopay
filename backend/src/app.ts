import express, { type Express } from "express";
import cors from "cors";
import { config, isOriginAllowed } from "./config/index.js";
import { prismaClient } from "./lib/prisma.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { generalRateLimit } from "./middleware/rateLimit.js";
import routes from "./routes/index.js";

/**
 * Builds the Express app.
 *
 * Kept separate from `index.ts` so that importing the app does not start a
 * listener or open a database connection — previously `index.ts` called
 * `startServer()` at module scope, so merely importing it for a test booted a
 * real server.
 */
export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1); // Render terminates TLS upstream; needed for real client IPs.

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  app.use(
    cors({
      // Function rather than a static list so localhost on any port works in
      // development without silently blocking the whole API. See isOriginAllowed.
      origin: (origin, callback) => callback(null, isOriginAllowed(origin ?? undefined)),
      credentials: true,
    }),
  );

  app.get("/health", async (_req, res) => {
    try {
      await prismaClient.$queryRaw`SELECT 1`;
      res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.env,
        database: "connected",
      });
    } catch {
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.env,
        database: "disconnected",
      });
    }
  });

  app.use("/v1", generalRateLimit, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;
