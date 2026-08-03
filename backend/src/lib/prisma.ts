import { PrismaClient } from "@prisma/client";
import { config } from "../config/index.js";
import { logger } from "./logger.js";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const baseClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Query logging is deafening on a hot path; keep it to real problems.
    log: ["warn", "error"],
    datasources: { db: { url: config.database.url } },
  });

if (!config.isProduction) globalForPrisma.prisma = baseClient;

/** Transient Prisma error codes worth retrying — connection and pool timeouts. */
const RETRYABLE = new Set(["P1001", "P1008", "P2024", "P5001"]);

export const prismaClient = baseClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        let retries = 5;
        for (;;) {
          try {
            return await query(args);
          } catch (error: any) {
            if (RETRYABLE.has(error?.code) && retries > 0) {
              retries -= 1;
              logger.warn("Database query failed, retrying", { code: error.code, retries });
              await new Promise((resolve) => setTimeout(resolve, 2000));
              continue;
            }
            throw error;
          }
        }
      },
    },
  },
});

/**
 * The client handed to an interactive `$transaction` callback.
 *
 * Not `Prisma.TransactionClient`: that describes an *unextended* client, and
 * `prismaClient` carries the retry extension above, so the two are structurally
 * incompatible. Services that take a `tx` parameter must use this type or they
 * will not accept the very client Prisma passes them.
 */
export type PrismaTx = Omit<
  typeof prismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function connectDB(retries = 8): Promise<void> {
  while (retries > 0) {
    try {
      await baseClient.$connect();
      logger.info("Database connected");
      return;
    } catch (error) {
      retries -= 1;
      logger.error("Database connection failed", {
        retriesRemaining: retries,
        error: error instanceof Error ? error.message : String(error),
      });
      if (retries === 0) throw new Error("Could not connect to database after multiple attempts");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

export async function disconnectDB(): Promise<void> {
  await baseClient.$disconnect();
}
