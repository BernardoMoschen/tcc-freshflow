import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  resolvePrice,
  calculateOrderItemTotal,
  calculateFixedItemPrice,
  formatPrice,
  persistCustomerPrice,
} from "../lib/price-engine.js";
import { mockPrisma } from "./setup.js";

describe("Price Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("resolvePrice", () => {
    it("should return base price when no overrides", async () => {
      mockPrisma.customerPrice.findUnique.mockResolvedValue(null);
      mockPrisma.productOption.findUnique.mockResolvedValue({
        id: "option-1",
        basePrice: 5000, // R$ 50.00
      });

      const price = await resolvePrice("option-1");

      expect(price).toBe(5000);
      expect(mockPrisma.productOption.findUnique).toHaveBeenCalledWith({
        where: { id: "option-1" },
        select: { basePrice: true },
      });
    });

    it("should prioritize customer price over base price", async () => {
      mockPrisma.customerPrice.findUnique.mockResolvedValue({
        id: "cp-1",
        price: 4500, // R$ 45.00 (discount)
      });
      mockPrisma.productOption.findUnique.mockResolvedValue({
        id: "option-1",
        basePrice: 5000,
      });

      const price = await resolvePrice("option-1", "customer-1");

      expect(price).toBe(4500);
      expect(mockPrisma.customerPrice.findUnique).toHaveBeenCalledWith({
        where: {
          customerId_productOptionId: {
            customerId: "customer-1",
            productOptionId: "option-1",
          },
        },
      });
    });

    it("should prioritize manual price over customer price", async () => {
      mockPrisma.customerPrice.findUnique.mockResolvedValue({
        id: "cp-1",
        price: 4500,
      });

      const price = await resolvePrice("option-1", "customer-1", 4200);

      expect(price).toBe(4200);
      // Should not even check customer price when manual price provided
      expect(mockPrisma.customerPrice.findUnique).not.toHaveBeenCalled();
    });

    it("should handle missing product option", async () => {
      mockPrisma.customerPrice.findUnique.mockResolvedValue(null);
      mockPrisma.productOption.findUnique.mockResolvedValue(null);

      await expect(resolvePrice("invalid-option")).rejects.toThrow(
        "Product option with ID invalid-option not found"
      );
    });
  });

  describe("calculateOrderItemTotal", () => {
    it("should calculate FIXED item total correctly", () => {
      const orderItem = {
        id: "item-1",
        finalPrice: 4000, // R$ 40.00 total (already includes quantity)
        requestedQty: 5,
        actualWeight: null,
        productOption: {
          unitType: "FIXED" as const,
          name: "1kg box",
        },
      };

      const total = calculateOrderItemTotal(orderItem as any);

      expect(total).toBe(4000);
    });

    it("should calculate WEIGHT item total correctly", () => {
      const orderItem = {
        id: "item-1",
        finalPrice: 4500, // R$ 45.00 per kg
        requestedQty: 2.5,
        actualWeight: 2.3, // Actually weighed 2.3kg
        productOption: {
          unitType: "WEIGHT" as const,
          name: "Per kg",
        },
      };

      const total = calculateOrderItemTotal(orderItem as any);

      expect(total).toBe(2.3 * 4500); // 10350 cents = R$ 103.50
    });

    it("should return 0 for WEIGHT item without actualWeight", () => {
      const orderItem = {
        id: "item-1",
        finalPrice: 4500,
        requestedQty: 2.5,
        actualWeight: null, // Not yet weighed
        productOption: {
          unitType: "WEIGHT" as const,
          name: "Per kg",
        },
      };

      const total = calculateOrderItemTotal(orderItem as any);

      expect(total).toBe(0);
    });

    it("should return 0 for WEIGHT item without finalPrice", () => {
      const orderItem = {
        id: "item-1",
        finalPrice: null,
        requestedQty: 2.5,
        actualWeight: 2.3,
        productOption: {
          unitType: "WEIGHT" as const,
          name: "Per kg",
        },
      };

      const total = calculateOrderItemTotal(orderItem as any);

      expect(total).toBe(0);
    });
  });

  describe("calculateFixedItemPrice", () => {
    it("should multiply unit price by quantity", async () => {
      mockPrisma.customerPrice.findUnique.mockResolvedValue(null);
      mockPrisma.productOption.findUnique.mockResolvedValue({
        basePrice: 850, // R$ 8.50 per unit
      });

      const price = await calculateFixedItemPrice("option-1", 5);

      expect(price).toBe(850 * 5); // 4250 cents = R$ 42.50
    });

    it("should use customer price when available", async () => {
      mockPrisma.customerPrice.findUnique.mockResolvedValue({
        price: 800, // R$ 8.00 per unit (discount)
      });

      const price = await calculateFixedItemPrice("option-1", 5, "customer-1");

      expect(price).toBe(800 * 5); // 4000 cents = R$ 40.00
    });
  });

  describe("formatPrice", () => {
    it("should format price in BRL currency", () => {
      expect(formatPrice(5000)).toBe("R$ 50,00");
      expect(formatPrice(4250)).toBe("R$ 42,50");
      expect(formatPrice(850)).toBe("R$ 8,50");
      expect(formatPrice(100)).toBe("R$ 1,00");
    });

    it("should handle zero", () => {
      expect(formatPrice(0)).toBe("R$ 0,00");
    });

    it("should handle large amounts", () => {
      expect(formatPrice(1234567)).toBe("R$ 12345,67");
    });
  });

  describe("persistCustomerPrice", () => {
    it("should upsert customer price", async () => {
      mockPrisma.customerPrice.upsert.mockResolvedValue({
        id: "cp-1",
        customerId: "customer-1",
        productOptionId: "option-1",
        price: 4200,
      });

      await persistCustomerPrice("customer-1", "option-1", 4200);

      expect(mockPrisma.customerPrice.upsert).toHaveBeenCalledWith({
        where: {
          customerId_productOptionId: {
            customerId: "customer-1",
            productOptionId: "option-1",
          },
        },
        create: {
          customerId: "customer-1",
          productOptionId: "option-1",
          price: 4200,
        },
        update: {
          price: 4200,
        },
      });
    });
  });
});
