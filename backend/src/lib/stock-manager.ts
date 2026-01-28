import { PrismaClient, StockMovementType, UnitType } from "@prisma/client";
import { TRPCError } from "@trpc/server";

/**
 * Check if sufficient stock is available for all items in an order
 */
export async function validateStockAvailability(
  prisma: PrismaClient,
  orderId: string
): Promise<void> {
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
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Order not found",
    });
  }

  const insufficientStock: Array<{
    productName: string;
    optionName: string;
    required: number;
    available: number;
  }> = [];

  for (const item of order.items) {
    const required = getRequiredQuantity(item);
    const available = item.productOption.stockQuantity ?? 0;

    if (available < required) {
      insufficientStock.push({
        productName: item.productOption.name,
        optionName: item.productOption.name,
        required,
        available,
      });
    }
  }

  if (insufficientStock.length > 0) {
    const details = insufficientStock
      .map(
        (item) =>
          `${item.productName}: needs ${item.required}, only ${item.available} available`
      )
      .join("; ");

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Insufficient stock for order finalization: ${details}`,
    });
  }
}

/**
 * Deduct stock for all items in an order and create stock movement records
 */
export async function deductStockForOrder(
  prisma: PrismaClient,
  orderId: string,
  userId: string
): Promise<void> {
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
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Order not found",
    });
  }

  // Use a transaction to ensure atomic stock deduction
  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      const quantityToDeduct = getRequiredQuantity(item);

      // Update stock quantity
      await tx.productOption.update({
        where: { id: item.productOptionId },
        data: {
          stockQuantity: {
            decrement: quantityToDeduct,
          },
        },
      });

      // Create stock movement record (audit trail)
      await tx.stockMovement.create({
        data: {
          productOptionId: item.productOptionId,
          type: StockMovementType.ORDER_FINALIZED,
          quantity: -quantityToDeduct, // negative for deduction
          orderId: order.id,
          orderItemId: item.id,
          notes: `Stock deducted for order ${order.orderNumber}`,
          userId,
        },
      });
    }
  });
}

/**
 * Helper: Get the quantity to deduct from stock for an order item
 * - FIXED items: use requestedQty
 * - WEIGHT items: use actualWeight (or requestedQty as fallback)
 */
function getRequiredQuantity(item: {
  productOption: { unitType: UnitType };
  requestedQty: number;
  actualWeight: number | null;
}): number {
  if (item.productOption.unitType === UnitType.WEIGHT) {
    // For weight items, use actual weight if available, otherwise requested quantity
    return item.actualWeight ?? item.requestedQty;
  }
  // For fixed items, use requested quantity
  return item.requestedQty;
}
