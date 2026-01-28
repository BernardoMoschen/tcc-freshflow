import { prisma } from "../db/prisma.js";
import type { OrderItem, ProductOption, CustomerPrice } from "@prisma/client";
import { Errors } from "./errors.js";

/**
 * Type for product option with customer prices for batch resolution
 */
export interface ProductOptionWithCustomerPrices {
  id: string;
  basePrice: number;
  customerPrices?: CustomerPrice[] | false;
}

/**
 * Resolved price information for a product option
 */
export interface ResolvedPrice {
  resolvedPrice: number;
  hasCustomerPrice: boolean;
}

/**
 * Resolve prices for multiple product options in batch
 * More efficient than calling resolvePrice individually
 */
export function resolvePricesBatch<T extends ProductOptionWithCustomerPrices>(
  options: T[]
): (T & ResolvedPrice)[] {
  return options.map((option) => {
    const customerPrice =
      option.customerPrices &&
      Array.isArray(option.customerPrices) &&
      option.customerPrices.length > 0
        ? option.customerPrices[0].price
        : null;

    return {
      ...option,
      resolvedPrice: customerPrice ?? option.basePrice,
      hasCustomerPrice: customerPrice !== null,
    };
  });
}

/**
 * Resolve price for a product option
 * Priority: manualPrice > customerPrice > basePrice
 */
export async function resolvePrice(
  productOptionId: string,
  customerId?: string,
  manualPrice?: number
): Promise<number> {
  // Manual price has highest priority
  if (manualPrice !== undefined && manualPrice !== null) {
    return manualPrice;
  }

  // Check for customer-specific price
  if (customerId) {
    const customerPrice = await prisma.customerPrice.findUnique({
      where: {
        customerId_productOptionId: {
          customerId,
          productOptionId,
        },
      },
    });

    if (customerPrice) {
      return customerPrice.price;
    }
  }

  // Fall back to base price
  const productOption = await prisma.productOption.findUnique({
    where: { id: productOptionId },
    select: { basePrice: true },
  });

  if (!productOption) {
    throw Errors.notFound("Product option", productOptionId);
  }

  return productOption.basePrice;
}

/**
 * Calculate total for a single order item
 * FIXED: finalPrice (set at creation, per unit/box)
 * WEIGHT: actualWeight × finalPrice (set at weighing, per kg)
 */
export function calculateOrderItemTotal(
  orderItem: OrderItem & { productOption: ProductOption }
): number {
  const { unitType } = orderItem.productOption;

  if (unitType === "FIXED") {
    // For fixed items: finalPrice is the total for all units
    // (finalPrice is already multiplied by requestedQty at creation)
    return orderItem.finalPrice || 0;
  }

  // For weight items: finalPrice is per kg, multiply by actualWeight
  if (unitType === "WEIGHT") {
    if (orderItem.actualWeight === null || orderItem.finalPrice === null) {
      return 0; // Not yet weighed
    }
    return orderItem.actualWeight * orderItem.finalPrice;
  }

  return 0;
}

/**
 * Calculate order totals (fixed + weighable + grand total)
 */
export async function calculateOrderTotals(orderId: string): Promise<{
  fixedTotal: number;
  weightTotal: number;
  total: number;
}> {
  const orderItems = await prisma.orderItem.findMany({
    where: { orderId },
    include: {
      productOption: true,
    },
  });

  let fixedTotal = 0;
  let weightTotal = 0;

  for (const item of orderItems) {
    const itemTotal = calculateOrderItemTotal(item);

    if (item.productOption.unitType === "FIXED") {
      fixedTotal += itemTotal;
    } else {
      weightTotal += itemTotal;
    }
  }

  return {
    fixedTotal,
    weightTotal,
    total: fixedTotal + weightTotal,
  };
}

/**
 * Calculate final price for FIXED item at order creation
 * Includes quantity in the final price
 */
export async function calculateFixedItemPrice(
  productOptionId: string,
  requestedQty: number,
  customerId?: string
): Promise<number> {
  const unitPrice = await resolvePrice(productOptionId, customerId);
  return unitPrice * requestedQty;
}

/**
 * Format price in cents to BRL currency string
 */
export function formatPrice(priceInCents: number): string {
  const reais = priceInCents / 100;
  return `R$ ${reais.toFixed(2).replace(".", ",")}`;
}

/**
 * Persist a price as customer-specific override
 */
export async function persistCustomerPrice(
  customerId: string,
  productOptionId: string,
  price: number
): Promise<void> {
  await prisma.customerPrice.upsert({
    where: {
      customerId_productOptionId: {
        customerId,
        productOptionId,
      },
    },
    create: {
      customerId,
      productOptionId,
      price,
    },
    update: {
      price,
    },
  });
}
