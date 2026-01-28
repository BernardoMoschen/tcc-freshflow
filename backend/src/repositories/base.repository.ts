import { PrismaClient } from "@prisma/client";
import { prisma } from "../db/prisma.js";

/**
 * Base repository class providing common database operations
 * All repositories should extend this class
 */
export abstract class BaseRepository {
  protected prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || prisma;
  }

  /**
   * Execute operations within a transaction
   */
  protected async withTransaction<T>(
    fn: (tx: PrismaClient) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      return fn(tx as unknown as PrismaClient);
    });
  }

  /**
   * Execute with pessimistic locking (FOR UPDATE)
   * Use this for operations that need to prevent concurrent modifications
   */
  protected async withLock<T>(
    tableName: string,
    id: string,
    fn: (tx: PrismaClient) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // Acquire row lock using raw query
      await tx.$executeRaw`SELECT 1 FROM ${tableName} WHERE id = ${id} FOR UPDATE`;
      return fn(tx as unknown as PrismaClient);
    });
  }
}
