import { PrismaClient } from "@prisma/client";
import { logger } from "../lib/logger.js";

/**
 * Query timeout in milliseconds
 * Can be overridden via PRISMA_QUERY_TIMEOUT env var
 */
const QUERY_TIMEOUT_MS = parseInt(process.env.PRISMA_QUERY_TIMEOUT || "30000", 10);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  // Add query timeout middleware
  client.$use(async (params, next) => {
    const start = Date.now();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Query timeout: ${params.model}.${params.action} exceeded ${QUERY_TIMEOUT_MS}ms`
          )
        );
      }, QUERY_TIMEOUT_MS);
    });

    try {
      const result = await Promise.race([next(params), timeoutPromise]);
      const duration = Date.now() - start;

      // Log slow queries (> 5 seconds) even in production
      if (duration > 5000) {
        logger.warn(`Slow query: ${params.model}.${params.action} took ${duration}ms`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`Query failed: ${params.model}.${params.action} after ${duration}ms`, error);
      throw error;
    }
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Graceful shutdown helper
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
