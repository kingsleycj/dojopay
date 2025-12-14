import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const baseClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL!,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = baseClient

export const prismaClient = baseClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, model, args, query }) {
        let retries = 3;
        while (true) {
          try {
            return await query(args);
          } catch (error: any) {
            // P1001: Can't reach database server
            // P1008: Operations timed out
            // P2024: Timed out fetching a new connection from the connection pool
            // P5001: Request timed out
            if (error?.code === 'P1001' || error?.code === 'P1008' || error?.code === 'P2024' || error?.code === 'P5001') {
              if (retries > 0) {
                retries--;
                console.warn(`Database query failed (Code: ${error.code}). Retrying in 2s... (${retries} retries left)`);
                await new Promise(r => setTimeout(r, 2000));
                continue;
              }
            }
            throw error;
          }
        }
      }
    }
  }
})

// Add connection status logging with retry
export async function connectDB(retries = 5) {
  while (retries > 0) {
    try {
      console.log("Connecting to database...");
      await baseClient.$connect();
      console.log("Database connected successfully");
      return;
    } catch (error) {
      console.error("Database connection failed:", error);
      retries -= 1;
      console.log(`Retries remaining: ${retries}`);
      if (retries === 0) {
        console.error("Could not connect to database after multiple attempts");
        process.exit(1);
      }
      // Wait for 2 seconds before retrying
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}
