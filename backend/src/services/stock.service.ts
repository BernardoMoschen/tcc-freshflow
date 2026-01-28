import { StockRepository, stockRepository } from "../repositories/stock.repository.js";
import { prisma } from "../db/prisma.js";
import { Errors } from "../lib/errors.js";
import { UnitType } from "@prisma/client";

export interface StockValidationResult {
  isValid: boolean;
  insufficientItems: Array<{
    productOptionId: string;
    productName: string;
    required: number;
    available: number;
  }>;
}

/**
 * Service layer for stock management business logic
 */
export class StockService {
  constructor(private repository: StockRepository = stockRepository) {}

  /**
   * Add stock to a product option
   */
  async addStock(
    productOptionId: string,
    quantity: number,
    userId: string,
    notes?: string
  ) {
    // Validate product option exists
    const productOption = await prisma.productOption.findUnique({
      where: { id: productOptionId },
      include: { product: true },
    });

    if (!productOption) {
      throw Errors.notFound("Product option", productOptionId);
    }

    return this.repository.addStock(productOptionId, quantity, userId, notes);
  }

  /**
   * Remove stock from a product option
   */
  async removeStock(
    productOptionId: string,
    quantity: number,
    userId: string,
    notes?: string
  ) {
    // Validate product option exists
    const productOption = await prisma.productOption.findUnique({
      where: { id: productOptionId },
    });

    if (!productOption) {
      throw Errors.notFound("Product option", productOptionId);
    }

    return this.repository.removeStock(productOptionId, quantity, userId, notes);
  }

  /**
   * Adjust stock to a specific quantity
   */
  async adjustStock(
    productOptionId: string,
    newQuantity: number,
    userId: string,
    notes?: string
  ) {
    // Validate product option exists
    const productOption = await prisma.productOption.findUnique({
      where: { id: productOptionId },
    });

    if (!productOption) {
      throw Errors.notFound("Product option", productOptionId);
    }

    return this.repository.adjustStock(productOptionId, newQuantity, userId, notes);
  }

  /**
   * Validate stock availability for an order
   */
  async validateStockForOrder(orderId: string): Promise<StockValidationResult> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            productOption: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw Errors.notFound("Order", orderId);
    }

    const insufficientItems: StockValidationResult["insufficientItems"] = [];

    for (const item of order.items) {
      const required = this.getRequiredQuantity(item);
      const available = item.productOption.stockQuantity ?? 0;

      if (available < required) {
        insufficientItems.push({
          productOptionId: item.productOptionId,
          productName: `${item.productOption.product.name} - ${item.productOption.name}`,
          required,
          available,
        });
      }
    }

    return {
      isValid: insufficientItems.length === 0,
      insufficientItems,
    };
  }

  /**
   * Deduct stock for an order (called during finalization)
   */
  async deductStockForOrder(orderId: string, userId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            productOption: true,
          },
        },
      },
    });

    if (!order) {
      throw Errors.notFound("Order", orderId);
    }

    // First validate
    const validation = await this.validateStockForOrder(orderId);
    if (!validation.isValid) {
      const details = validation.insufficientItems
        .map((item) => `${item.productName}: needs ${item.required}, only ${item.available} available`)
        .join("; ");
      throw Errors.badRequest(`Insufficient stock: ${details}`);
    }

    // Prepare items for deduction
    const items = order.items.map((item) => ({
      productOptionId: item.productOptionId,
      quantity: this.getRequiredQuantity(item),
      orderItemId: item.id,
    }));

    return this.repository.deductStockForOrder(
      items,
      orderId,
      order.orderNumber,
      userId
    );
  }

  /**
   * Restore stock for a cancelled order
   */
  async restoreStockForOrder(orderId: string, userId: string, reason?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            productOption: true,
          },
        },
      },
    });

    if (!order) {
      throw Errors.notFound("Order", orderId);
    }

    // Prepare items for restoration
    const items = order.items.map((item) => ({
      productOptionId: item.productOptionId,
      quantity: this.getRequiredQuantity(item),
      orderItemId: item.id,
    }));

    return this.repository.restoreStockForOrder(
      items,
      orderId,
      order.orderNumber,
      userId,
      reason
    );
  }

  /**
   * Get stock movements history
   */
  async getMovements(params: Parameters<StockRepository["getMovements"]>[0]) {
    return this.repository.getMovements(params);
  }

  /**
   * Get stock levels with filtering
   */
  async getStockLevels(params: Parameters<StockRepository["getStockLevels"]>[0]) {
    return this.repository.getStockLevels(params);
  }

  /**
   * Toggle product availability
   */
  async toggleAvailability(productOptionId: string, isAvailable: boolean) {
    return prisma.productOption.update({
      where: { id: productOptionId },
      data: { isAvailable },
    });
  }

  /**
   * Get required quantity for an order item based on unit type
   */
  private getRequiredQuantity(item: {
    productOption: { unitType: UnitType };
    requestedQty: number;
    actualWeight: number | null;
  }): number {
    if (item.productOption.unitType === UnitType.WEIGHT) {
      return item.actualWeight ?? item.requestedQty;
    }
    return item.requestedQty;
  }
}

// Export singleton instance
export const stockService = new StockService();
