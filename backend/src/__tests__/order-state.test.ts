import { describe, it, expect } from "vitest";
import { OrderStatus, RoleType } from "@prisma/client";
import {
  canTransition,
  validateOrderTransition,
  isOrderImmutable,
  validateOrderMutable,
  validateOrderCanFinalize,
  validateCanWeighItem,
  generateOrderNumber,
  canPerformOrderAction,
} from "../lib/order-state.js";

// Helper to create a minimal Order object
function makeOrder(
  overrides: Partial<{
    status: OrderStatus;
    orderNumber: string;
  }> = {}
) {
  return {
    id: "order-1",
    orderNumber: overrides.orderNumber ?? "PED-001",
    customerId: "cust-1",
    accountId: "acc-1",
    createdBy: "user-1",
    status: overrides.status ?? OrderStatus.DRAFT,
    notes: null,
    requestedDeliveryDate: null,
    deliveryTimeSlot: null,
    deliveryInstructions: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    sentAt: null,
    finalizedAt: null,
  };
}

// Helper to create a minimal OrderItem with ProductOption
function makeOrderItem(
  overrides: Partial<{
    unitType: "FIXED" | "WEIGHT";
    actualWeight: number | null;
  }> = {}
) {
  return {
    id: "item-1",
    orderId: "order-1",
    productOptionId: "opt-1",
    requestedQty: 5,
    actualWeight: overrides.actualWeight ?? null,
    finalPrice: 1000,
    isExtra: false,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    productOption: {
      id: "opt-1",
      productId: "prod-1",
      name: "Por kg",
      sku: "TEST-KG",
      unitType: overrides.unitType ?? "WEIGHT",
      basePrice: 1000,
      stockQuantity: 50,
      lowStockThreshold: 10,
      isAvailable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

describe("Order State Machine", () => {
  describe("canTransition", () => {
    it("should allow DRAFT → SENT", () => {
      expect(canTransition(OrderStatus.DRAFT, OrderStatus.SENT)).toBe(true);
    });

    it("should allow SENT → IN_SEPARATION", () => {
      expect(
        canTransition(OrderStatus.SENT, OrderStatus.IN_SEPARATION)
      ).toBe(true);
    });

    it("should allow IN_SEPARATION → FINALIZED", () => {
      expect(
        canTransition(OrderStatus.IN_SEPARATION, OrderStatus.FINALIZED)
      ).toBe(true);
    });

    it("should NOT allow DRAFT → FINALIZED (skip)", () => {
      expect(canTransition(OrderStatus.DRAFT, OrderStatus.FINALIZED)).toBe(
        false
      );
    });

    it("should NOT allow DRAFT → IN_SEPARATION (skip)", () => {
      expect(
        canTransition(OrderStatus.DRAFT, OrderStatus.IN_SEPARATION)
      ).toBe(false);
    });

    it("should NOT allow FINALIZED → anything (terminal)", () => {
      expect(canTransition(OrderStatus.FINALIZED, OrderStatus.DRAFT)).toBe(
        false
      );
      expect(canTransition(OrderStatus.FINALIZED, OrderStatus.SENT)).toBe(
        false
      );
      expect(
        canTransition(OrderStatus.FINALIZED, OrderStatus.IN_SEPARATION)
      ).toBe(false);
    });

    it("should NOT allow backwards transitions", () => {
      expect(canTransition(OrderStatus.SENT, OrderStatus.DRAFT)).toBe(false);
      expect(
        canTransition(OrderStatus.IN_SEPARATION, OrderStatus.SENT)
      ).toBe(false);
      expect(
        canTransition(OrderStatus.FINALIZED, OrderStatus.IN_SEPARATION)
      ).toBe(false);
    });
  });

  describe("validateOrderTransition", () => {
    it("should not throw for valid transition", () => {
      const order = makeOrder({ status: OrderStatus.DRAFT });
      expect(() =>
        validateOrderTransition(order, OrderStatus.SENT)
      ).not.toThrow();
    });

    it("should throw for invalid transition", () => {
      const order = makeOrder({ status: OrderStatus.DRAFT });
      expect(() =>
        validateOrderTransition(order, OrderStatus.FINALIZED)
      ).toThrow("Invalid transition from DRAFT to FINALIZED");
    });
  });

  describe("isOrderImmutable", () => {
    it("should return false for DRAFT", () => {
      expect(isOrderImmutable(makeOrder({ status: OrderStatus.DRAFT }))).toBe(
        false
      );
    });

    it("should return true for SENT", () => {
      expect(isOrderImmutable(makeOrder({ status: OrderStatus.SENT }))).toBe(
        true
      );
    });

    it("should return true for IN_SEPARATION", () => {
      expect(
        isOrderImmutable(makeOrder({ status: OrderStatus.IN_SEPARATION }))
      ).toBe(true);
    });

    it("should return true for FINALIZED", () => {
      expect(
        isOrderImmutable(makeOrder({ status: OrderStatus.FINALIZED }))
      ).toBe(true);
    });
  });

  describe("validateOrderMutable", () => {
    it("should not throw for DRAFT order", () => {
      expect(() =>
        validateOrderMutable(makeOrder({ status: OrderStatus.DRAFT }))
      ).not.toThrow();
    });

    it("should throw for SENT order", () => {
      expect(() =>
        validateOrderMutable(
          makeOrder({ status: OrderStatus.SENT, orderNumber: "PED-099" })
        )
      ).toThrow("PED-099 is SENT and cannot be modified");
    });
  });

  describe("validateOrderCanFinalize", () => {
    it("should throw if order is already FINALIZED", () => {
      const order = {
        ...makeOrder({ status: OrderStatus.FINALIZED, orderNumber: "PED-050" }),
        items: [],
      };
      expect(() => validateOrderCanFinalize(order as any)).toThrow(
        "already been finalized"
      );
    });

    it("should throw if WEIGHT items are not weighed", () => {
      const order = {
        ...makeOrder({ status: OrderStatus.IN_SEPARATION }),
        items: [
          makeOrderItem({ unitType: "WEIGHT", actualWeight: null }),
        ],
      };
      expect(() => validateOrderCanFinalize(order as any)).toThrow(
        "not yet weighed"
      );
    });

    it("should pass if all WEIGHT items are weighed", () => {
      const order = {
        ...makeOrder({ status: OrderStatus.IN_SEPARATION }),
        items: [
          makeOrderItem({ unitType: "WEIGHT", actualWeight: 4.5 }),
          makeOrderItem({ unitType: "FIXED" }),
        ],
      };
      expect(() => validateOrderCanFinalize(order as any)).not.toThrow();
    });

    it("should pass if order has only FIXED items", () => {
      const order = {
        ...makeOrder({ status: OrderStatus.IN_SEPARATION }),
        items: [makeOrderItem({ unitType: "FIXED" })],
      };
      expect(() => validateOrderCanFinalize(order as any)).not.toThrow();
    });
  });

  describe("validateCanWeighItem", () => {
    it("should throw for FINALIZED order", () => {
      const order = makeOrder({
        status: OrderStatus.FINALIZED,
        orderNumber: "PED-100",
      });
      const item = makeOrderItem({ unitType: "WEIGHT" });
      expect(() => validateCanWeighItem(order, item as any)).toThrow(
        "already been finalized"
      );
    });

    it("should throw for FIXED unit type item", () => {
      const order = makeOrder({ status: OrderStatus.IN_SEPARATION });
      const item = makeOrderItem({ unitType: "FIXED" });
      expect(() => validateCanWeighItem(order, item as any)).toThrow(
        "Cannot weigh a fixed-unit item"
      );
    });

    it("should pass for WEIGHT item on non-finalized order", () => {
      const order = makeOrder({ status: OrderStatus.IN_SEPARATION });
      const item = makeOrderItem({ unitType: "WEIGHT" });
      expect(() => validateCanWeighItem(order, item as any)).not.toThrow();
    });
  });

  describe("generateOrderNumber", () => {
    it("should start with ORD-", () => {
      const num = generateOrderNumber();
      expect(num).toMatch(/^ORD-/);
    });

    it("should contain timestamp and random suffix", () => {
      const num = generateOrderNumber();
      expect(num).toMatch(/^ORD-\d+-\d{3}$/);
    });

    it("should generate unique numbers", () => {
      const nums = new Set(
        Array.from({ length: 20 }, () => generateOrderNumber())
      );
      // With timestamp + random, collisions should be extremely rare
      expect(nums.size).toBeGreaterThanOrEqual(15);
    });
  });

  describe("canPerformOrderAction", () => {
    it("PLATFORM_ADMIN can do everything", () => {
      const actions = ["create", "view", "weigh", "finalize", "delete"] as const;
      for (const action of actions) {
        expect(canPerformOrderAction(RoleType.PLATFORM_ADMIN, action)).toBe(
          true
        );
      }
    });

    it("TENANT_OWNER can view, weigh, finalize but not create/delete", () => {
      expect(canPerformOrderAction(RoleType.TENANT_OWNER, "view")).toBe(true);
      expect(canPerformOrderAction(RoleType.TENANT_OWNER, "weigh")).toBe(true);
      expect(canPerformOrderAction(RoleType.TENANT_OWNER, "finalize")).toBe(
        true
      );
      expect(canPerformOrderAction(RoleType.TENANT_OWNER, "create")).toBe(
        false
      );
      expect(canPerformOrderAction(RoleType.TENANT_OWNER, "delete")).toBe(
        false
      );
    });

    it("ACCOUNT_OWNER can create and view but not weigh/finalize/delete", () => {
      expect(canPerformOrderAction(RoleType.ACCOUNT_OWNER, "create")).toBe(
        true
      );
      expect(canPerformOrderAction(RoleType.ACCOUNT_OWNER, "view")).toBe(true);
      expect(canPerformOrderAction(RoleType.ACCOUNT_OWNER, "weigh")).toBe(
        false
      );
      expect(canPerformOrderAction(RoleType.ACCOUNT_OWNER, "finalize")).toBe(
        false
      );
      expect(canPerformOrderAction(RoleType.ACCOUNT_OWNER, "delete")).toBe(
        false
      );
    });

    it("ACCOUNT_BUYER can create and view only", () => {
      expect(canPerformOrderAction(RoleType.ACCOUNT_BUYER, "create")).toBe(
        true
      );
      expect(canPerformOrderAction(RoleType.ACCOUNT_BUYER, "view")).toBe(true);
      expect(canPerformOrderAction(RoleType.ACCOUNT_BUYER, "weigh")).toBe(
        false
      );
      expect(canPerformOrderAction(RoleType.ACCOUNT_BUYER, "delete")).toBe(
        false
      );
    });
  });
});
