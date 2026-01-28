/**
 * Shared TypeScript types for the application
 * These replace excessive use of 'any' throughout the codebase
 */

import type { Prisma, OrderStatus } from "@prisma/client";

// ========== Order Types ==========

/**
 * Order with related entities for notifications
 */
export interface OrderWithRelations {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  sentAt: Date | null;
  finalizedAt: Date | null;
  accountId: string;
  customerId: string;
  createdBy: string;
  customer?: {
    id: string;
    account?: {
      id: string;
      name: string;
    };
  };
  items: OrderItemWithRelations[];
}

/**
 * Order item with product option details
 */
export interface OrderItemWithRelations {
  id: string;
  orderId: string;
  productOptionId: string;
  requestedQty: number;
  actualWeight: number | null;
  finalPrice: number | null;
  isExtra: boolean;
  notes: string | null;
  productOption?: {
    id: string;
    name: string;
    sku: string;
    unitType: string;
    basePrice: number;
    product?: {
      id: string;
      name: string;
    };
  };
}

// ========== Query Filter Types ==========

/**
 * Order list query filter
 */
export interface OrderListFilter {
  accountId?: string;
  status?: OrderStatus;
}

/**
 * Stock movement query filter
 */
export interface StockMovementFilter {
  productOptionId?: string;
  movementType?: string;
  tenantId: string;
}

/**
 * Product list query filter
 */
export interface ProductListFilter {
  tenantId: string;
  OR?: Array<{
    name?: { contains: string; mode: "insensitive" };
    description?: { contains: string; mode: "insensitive" };
  }>;
  category?: string;
  options?: {
    some: {
      basePrice?: { gte?: number; lte?: number };
      unitType?: string;
    };
  };
}

/**
 * Customer list query filter
 */
export interface CustomerListFilter {
  account: {
    tenantId: string;
    name?: {
      contains: string;
      mode: "insensitive";
    };
  };
}

// ========== Cache Types ==========

/**
 * Memory cache entry with expiry
 */
export interface CacheEntry<T> {
  value: T;
  expiry: number;
}

/**
 * Product list cache data
 */
export interface ProductListCache {
  items: unknown[];
  total: number;
}

/**
 * Product detail cache data
 */
export interface ProductDetailCache {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  imageUrl: string | null;
  options: unknown[];
}

/**
 * Customer prices cache data
 */
export interface CustomerPricesCache {
  prices: Array<{
    productOptionId: string;
    price: number;
  }>;
}

/**
 * Session cache data
 */
export interface SessionCache {
  userId: string;
  tenantId: string | null;
  accountId: string | null;
  roles: string[];
}

/**
 * Stock levels cache data
 */
export interface StockLevelsCache {
  levels: Array<{
    productOptionId: string;
    quantity: number;
  }>;
}

// ========== Prisma Where Clause Types ==========

/**
 * Type-safe Prisma where clause builder
 */
export type OrderWhereInput = Prisma.OrderWhereInput;
export type ProductWhereInput = Prisma.ProductWhereInput;
export type ProductOptionWhereInput = Prisma.ProductOptionWhereInput;
export type CustomerWhereInput = Prisma.CustomerWhereInput;
export type StockMovementWhereInput = Prisma.StockMovementWhereInput;
