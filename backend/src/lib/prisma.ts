import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL!,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaClient

// Add connection status logging with retry
prismaClient.$connect()
  .then(() => console.log("Database connected successfully"))
  .catch((error) => {
    console.error("Database connection failed:", error);
    // Retry connection after 5 seconds
    setTimeout(() => {
      console.log("Retrying database connection...");
      prismaClient.$connect()
        .then(() => console.log("Database connected successfully on retry"))
        .catch((retryError) => console.error("Retry failed:", retryError));
    }, 5000);
  });
