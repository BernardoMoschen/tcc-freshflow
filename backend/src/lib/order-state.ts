import { OrderStatus, RoleType } from "@prisma/client";
import type { Order, OrderItem, ProductOption } from "@prisma/client";
import { Errors } from "./errors.js";

/**
 * Valid order status transitions
 */
const validTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.DRAFT]: [OrderStatus.SENT],
  [OrderStatus.SENT]: [OrderStatus.IN_SEPARATION],
  [OrderStatus.IN_SEPARATION]: [OrderStatus.FINALIZED],
  [OrderStatus.FINALIZED]: [], // Terminal state
};

/**
 * Check if a status transition is valid
 */
export function canTransition(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus
): boolean {
  return validTransitions[currentStatus].includes(targetStatus);
}

/**
 * Validate order transition and throw if invalid
 */
export function validateOrderTransition(
  order: Order,
  targetStatus: OrderStatus
): void {
  if (!canTransition(order.status, targetStatus)) {
    throw Errors.badRequest(
      `Invalid transition from ${order.status} to ${targetStatus}`
    );
  }
}

/**
 * Check if order is immutable (SENT or later)
 * SENT orders cannot have items added/removed/modified
 */
export function isOrderImmutable(order: Order): boolean {
  return order.status !== OrderStatus.DRAFT;
}

/**
 * Validate that order can be modified
 */
export function validateOrderMutable(order: Order): void {
  if (isOrderImmutable(order)) {
    throw Errors.badRequest(
      `Order ${order.orderNumber} is ${order.status} and cannot be modified`
    );
  }
}

/**
 * Validate that order can be finalized
 * All WEIGHT items must have actualWeight set
 */
export function validateOrderCanFinalize(
  order: Order & {
    items: (OrderItem & { productOption: ProductOption })[];
  }
): void {
  if (order.status === OrderStatus.FINALIZED) {
    throw Errors.orderAlreadyFinalized(order.orderNumber);
  }

  // Check all WEIGHT items have actualWeight
  const weightItems = order.items.filter(
    (item) => item.productOption.unitType === "WEIGHT"
  );

  const unweighedItems = weightItems.filter(
    (item) => item.actualWeight === null
  );

  if (unweighedItems.length > 0) {
    const itemDescriptions = unweighedItems
      .map((item) => item.productOption.name)
      .join(", ");

    throw Errors.orderNotReady(
      `${unweighedItems.length} item(s) not yet weighed: ${itemDescriptions}`
    );
  }
}

/**
 * Validate that an order item can be weighed
 */
export function validateCanWeighItem(
  order: Order,
  orderItem: OrderItem & { productOption: ProductOption }
): void {
  // Cannot weigh finalized orders
  if (order.status === OrderStatus.FINALIZED) {
    throw Errors.orderAlreadyFinalized(order.orderNumber);
  }

  // Only WEIGHT type items can be weighed
  if (orderItem.productOption.unitType !== "WEIGHT") {
    throw Errors.cannotWeighFixedItem();
  }
}

/**
 * Generate unique order number
 */
export function generateOrderNumber(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `ORD-${timestamp}-${random}`;
}

/**
 * Check if user can perform action on order based on role
 */
export function canPerformOrderAction(
  userRole: RoleType,
  action: "create" | "view" | "weigh" | "finalize" | "delete"
): boolean {
  const permissions: Record<RoleType, string[]> = {
    [RoleType.PLATFORM_ADMIN]: ["create", "view", "weigh", "finalize", "delete"],
    [RoleType.TENANT_OWNER]: ["view", "weigh", "finalize"],
    [RoleType.TENANT_ADMIN]: ["view", "weigh", "finalize"],
    [RoleType.ACCOUNT_OWNER]: ["create", "view"],
    [RoleType.ACCOUNT_BUYER]: ["create", "view"],
  };

  return permissions[userRole]?.includes(action) || false;
}
