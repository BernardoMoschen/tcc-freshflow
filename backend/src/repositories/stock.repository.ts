import { PrismaClient, StockMovementType, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";

export interface StockMovementInput {
  productOptionId: string;
  type: StockMovementType;
  quantity: number;
  notes?: string;
  userId: string;
  orderId?: string;
  orderItemId?: string;
}

export interface StockUpdateResult {
  productOptionId: string;
  previousQuantity: number;
  newQuantity: number;
  movementId: string;
}

/**
 * Repository for stock-related database operations
 * Handles atomic stock updates with row-level locking
 */
export class StockRepository {
  constructor(private db: PrismaClient = prisma) {}

  /**
   * Add stock with pessimistic locking to prevent race conditions
   */
  async addStock(
    productOptionId: string,
    quantity: number,
    userId: string,
    notes?: string
  ): Promise<StockUpdateResult> {
    return this.db.$transaction(async (tx) => {
      // Lock the row for update
      const [locked] = await tx.$queryRaw<Array<{ id: string; stockQuantity: number | null }>>`
        SELECT id, "stockQuantity"
        FROM "ProductOption"
        WHERE id = ${productOptionId}::uuid
        FOR UPDATE
      `;

      if (!locked) {
        throw new Error(`Product option not found: ${productOptionId}`);
      }

      const previousQuantity = locked.stockQuantity ?? 0;
      const newQuantity = previousQuantity + quantity;

      // Update stock
      await tx.productOption.update({
        where: { id: productOptionId },
        data: { stockQuantity: newQuantity },
      });

      // Create movement record
      const movement = await tx.stockMovement.create({
        data: {
          productOptionId,
          type: StockMovementType.MANUAL_ADDITION,
          quantity,
          notes: notes || `Added ${quantity} units`,
          userId,
        },
      });

      return {
        productOptionId,
        previousQuantity,
        newQuantity,
        movementId: movement.id,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Remove stock with pessimistic locking
   */
  async removeStock(
    productOptionId: string,
    quantity: number,
    userId: string,
    notes?: string
  ): Promise<StockUpdateResult> {
    return this.db.$transaction(async (tx) => {
      // Lock the row for update
      const [locked] = await tx.$queryRaw<Array<{ id: string; stockQuantity: number | null }>>`
        SELECT id, "stockQuantity"
        FROM "ProductOption"
        WHERE id = ${productOptionId}::uuid
        FOR UPDATE
      `;

      if (!locked) {
        throw new Error(`Product option not found: ${productOptionId}`);
      }

      const previousQuantity = locked.stockQuantity ?? 0;

      if (previousQuantity < quantity) {
        throw new Error(
          `Insufficient stock. Available: ${previousQuantity}, Requested: ${quantity}`
        );
      }

      const newQuantity = previousQuantity - quantity;

      // Update stock
      await tx.productOption.update({
        where: { id: productOptionId },
        data: { stockQuantity: newQuantity },
      });

      // Create movement record
      const movement = await tx.stockMovement.create({
        data: {
          productOptionId,
          type: StockMovementType.MANUAL_DEDUCTION,
          quantity: -quantity,
          notes: notes || `Removed ${quantity} units`,
          userId,
        },
      });

      return {
        productOptionId,
        previousQuantity,
        newQuantity,
        movementId: movement.id,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Adjust stock to a specific quantity with locking
   */
  async adjustStock(
    productOptionId: string,
    newQuantity: number,
    userId: string,
    notes?: string
  ): Promise<StockUpdateResult> {
    return this.db.$transaction(async (tx) => {
      // Lock the row for update
      const [locked] = await tx.$queryRaw<Array<{ id: string; stockQuantity: number | null }>>`
        SELECT id, "stockQuantity"
        FROM "ProductOption"
        WHERE id = ${productOptionId}::uuid
        FOR UPDATE
      `;

      if (!locked) {
        throw new Error(`Product option not found: ${productOptionId}`);
      }

      const previousQuantity = locked.stockQuantity ?? 0;
      const difference = newQuantity - previousQuantity;

      // Update stock
      await tx.productOption.update({
        where: { id: productOptionId },
        data: { stockQuantity: newQuantity },
      });

      // Create movement record
      const movement = await tx.stockMovement.create({
        data: {
          productOptionId,
          type: StockMovementType.ADJUSTMENT,
          quantity: difference,
          notes:
            notes ||
            `Adjusted from ${previousQuantity} to ${newQuantity} (${difference > 0 ? "+" : ""}${difference})`,
          userId,
        },
      });

      return {
        productOptionId,
        previousQuantity,
        newQuantity,
        movementId: movement.id,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Deduct stock for multiple items atomically (for order finalization)
   */
  async deductStockForOrder(
    items: Array<{
      productOptionId: string;
      quantity: number;
      orderItemId: string;
    }>,
    orderId: string,
    orderNumber: string,
    userId: string
  ): Promise<StockUpdateResult[]> {
    return this.db.$transaction(async (tx) => {
      const results: StockUpdateResult[] = [];

      for (const item of items) {
        // Lock each row for update
        const [locked] = await tx.$queryRaw<Array<{ id: string; stockQuantity: number | null }>>`
          SELECT id, "stockQuantity"
          FROM "ProductOption"
          WHERE id = ${item.productOptionId}::uuid
          FOR UPDATE
        `;

        if (!locked) {
          throw new Error(`Product option not found: ${item.productOptionId}`);
        }

        const previousQuantity = locked.stockQuantity ?? 0;

        if (previousQuantity < item.quantity) {
          throw new Error(
            `Insufficient stock for item. Available: ${previousQuantity}, Required: ${item.quantity}`
          );
        }

        const newQuantity = previousQuantity - item.quantity;

        // Update stock
        await tx.productOption.update({
          where: { id: item.productOptionId },
          data: { stockQuantity: newQuantity },
        });

        // Create movement record
        const movement = await tx.stockMovement.create({
          data: {
            productOptionId: item.productOptionId,
            type: StockMovementType.ORDER_FINALIZED,
            quantity: -item.quantity,
            orderId,
            orderItemId: item.orderItemId,
            notes: `Stock deducted for order ${orderNumber}`,
            userId,
          },
        });

        results.push({
          productOptionId: item.productOptionId,
          previousQuantity,
          newQuantity,
          movementId: movement.id,
        });
      }

      return results;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Restore stock for cancelled order
   */
  async restoreStockForOrder(
    items: Array<{
      productOptionId: string;
      quantity: number;
      orderItemId: string;
    }>,
    orderId: string,
    orderNumber: string,
    userId: string,
    reason?: string
  ): Promise<StockUpdateResult[]> {
    return this.db.$transaction(async (tx) => {
      const results: StockUpdateResult[] = [];

      for (const item of items) {
        // Lock the row for update
        const [locked] = await tx.$queryRaw<Array<{ id: string; stockQuantity: number | null }>>`
          SELECT id, "stockQuantity"
          FROM "ProductOption"
          WHERE id = ${item.productOptionId}::uuid
          FOR UPDATE
        `;

        if (!locked) {
          throw new Error(`Product option not found: ${item.productOptionId}`);
        }

        const previousQuantity = locked.stockQuantity ?? 0;
        const newQuantity = previousQuantity + item.quantity;

        // Update stock
        await tx.productOption.update({
          where: { id: item.productOptionId },
          data: { stockQuantity: newQuantity },
        });

        // Create movement record
        const movement = await tx.stockMovement.create({
          data: {
            productOptionId: item.productOptionId,
            type: "RETURN" as StockMovementType,
            quantity: item.quantity,
            orderId,
            orderItemId: item.orderItemId,
            notes: reason || `Order cancelled: ${orderNumber}`,
            userId,
          },
        });

        results.push({
          productOptionId: item.productOptionId,
          previousQuantity,
          newQuantity,
          movementId: movement.id,
        });
      }

      return results;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Get stock movements with pagination
   */
  async getMovements(params: {
    productOptionId?: string;
    type?: StockMovementType;
    skip?: number;
    take?: number;
  }) {
    const { productOptionId, type, skip = 0, take = 50 } = params;

    const where: any = {};
    if (productOptionId) where.productOptionId = productOptionId;
    if (type) where.type = type;

    const [items, total] = await Promise.all([
      this.db.stockMovement.findMany({
        where,
        skip,
        take,
        include: {
          productOption: {
            include: {
              product: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      this.db.stockMovement.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Get stock levels with low stock filtering
   */
  async getStockLevels(params: {
    tenantId: string;
    category?: string;
    lowStockOnly?: boolean;
    skip?: number;
    take?: number;
  }) {
    const { tenantId, category, lowStockOnly = false, skip = 0, take = 50 } = params;

    const where: any = { tenantId };
    if (category) where.category = category;

    const products = await this.db.product.findMany({
      where,
      skip,
      take,
      include: {
        options: {
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    const stockLevels = products.flatMap((product) =>
      product.options
        .filter((option) => {
          if (!lowStockOnly) return true;
          const stock = option.stockQuantity ?? 0;
          const threshold = option.lowStockThreshold ?? 10;
          return stock <= threshold;
        })
        .map((option) => {
          const stock = option.stockQuantity ?? 0;
          const threshold = option.lowStockThreshold ?? 10;
          return {
            productId: product.id,
            productName: product.name,
            productCategory: product.category,
            optionId: option.id,
            optionName: option.name,
            sku: option.sku,
            unitType: option.unitType,
            stockQuantity: stock,
            lowStockThreshold: threshold,
            isLowStock: stock <= threshold && stock > 0,
            isOutOfStock: stock === 0 || !option.isAvailable,
            isAvailable: option.isAvailable,
          };
        })
    );

    const total = await this.db.product.count({ where });

    return { items: stockLevels, total };
  }
}

// Export singleton instance
export const stockRepository = new StockRepository();
