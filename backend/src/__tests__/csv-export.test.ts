import { describe, it, expect } from "vitest";
import { OrderStatus } from "@prisma/client";
import {
  generateOrdersCsv,
  generateCsvFilename,
} from "../lib/csv-export.js";

// Helper to create a minimal order for CSV export
function makeExportOrder(
  overrides: Partial<{
    orderNumber: string;
    status: OrderStatus;
    notes: string | null;
    items: any[];
  }> = {}
) {
  return {
    id: "order-1",
    orderNumber: overrides.orderNumber ?? "PED-001",
    customerId: "cust-1",
    accountId: "acc-1",
    createdBy: "user-1",
    status: overrides.status ?? OrderStatus.SENT,
    notes: overrides.notes ?? null,
    requestedDeliveryDate: null,
    deliveryTimeSlot: null,
    deliveryInstructions: null,
    createdAt: new Date("2025-01-15T10:00:00Z"),
    updatedAt: new Date("2025-01-15T10:00:00Z"),
    sentAt: new Date("2025-01-15T10:30:00Z"),
    finalizedAt: null,
    customer: {
      account: { name: "Restaurante Sabor da Terra" },
    },
    createdByUser: {
      name: "Roberto Santos",
      email: "roberto@sabordaterra.com.br",
    },
    items: overrides.items ?? [],
  };
}

function makeExportItem(
  overrides: Partial<{
    productName: string;
    category: string | null;
    sku: string;
    optionName: string;
    requestedQty: number;
    actualWeight: number | null;
    finalPrice: number | null;
    isExtra: boolean;
  }> = {}
) {
  return {
    id: "item-1",
    orderId: "order-1",
    productOptionId: "opt-1",
    requestedQty: overrides.requestedQty ?? 5,
    actualWeight: overrides.actualWeight ?? null,
    finalPrice: overrides.finalPrice ?? 2500,
    isExtra: overrides.isExtra ?? false,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    productOption: {
      name: overrides.optionName ?? "Caixa 5kg",
      sku: overrides.sku ?? "TOM-CX5",
      product: {
        name: overrides.productName ?? "Tomate Italiano",
        category: overrides.category ?? "Hortaliças",
      },
    },
  };
}

describe("CSV Export", () => {
  describe("generateOrdersCsv", () => {
    it("should generate CSV with correct headers", () => {
      const csv = generateOrdersCsv([]);
      const headers = csv.split("\n")[0];

      expect(headers).toContain("Número do Pedido");
      expect(headers).toContain("Status");
      expect(headers).toContain("Cliente");
      expect(headers).toContain("Produto");
      expect(headers).toContain("SKU");
      expect(headers).toContain("Quantidade Solicitada");
      expect(headers).toContain("Preço Total");
    });

    it("should return only headers for empty orders array", () => {
      const csv = generateOrdersCsv([]);
      const lines = csv.split("\n");
      expect(lines).toHaveLength(1); // Only headers
    });

    it("should generate one row per order item", () => {
      const order = makeExportOrder({
        items: [
          makeExportItem({ productName: "Tomate" }),
          makeExportItem({ productName: "Alface", sku: "ALF-MC" }),
        ],
      });

      const csv = generateOrdersCsv([order as any]);
      const lines = csv.split("\n");
      expect(lines).toHaveLength(3); // headers + 2 items
    });

    it("should handle order with no items (empty row)", () => {
      const order = makeExportOrder({ items: [] });
      const csv = generateOrdersCsv([order as any]);
      const lines = csv.split("\n");
      expect(lines).toHaveLength(2); // headers + 1 empty order row
      expect(lines[1]).toContain("PED-001");
    });

    it("should translate status to Portuguese", () => {
      const order = makeExportOrder({
        status: OrderStatus.IN_SEPARATION,
        items: [makeExportItem()],
      });

      const csv = generateOrdersCsv([order as any]);
      expect(csv).toContain("Em Separação");
    });

    it("should mark extra items as Sim", () => {
      const order = makeExportOrder({
        items: [makeExportItem({ isExtra: true })],
      });

      const csv = generateOrdersCsv([order as any]);
      expect(csv).toContain("Sim");
    });

    it("should escape fields with commas", () => {
      const order = makeExportOrder({
        notes: "Pedido urgente, entregar rápido",
        items: [makeExportItem()],
      });

      const csv = generateOrdersCsv([order as any]);
      // Commas in notes should be wrapped in quotes
      expect(csv).toContain('"Pedido urgente, entregar rápido"');
    });

    it("should escape fields with double quotes", () => {
      const order = makeExportOrder({
        notes: 'Cliente disse "prioridade"',
        items: [makeExportItem()],
      });

      const csv = generateOrdersCsv([order as any]);
      expect(csv).toContain('"Cliente disse ""prioridade"""');
    });
  });

  describe("generateCsvFilename", () => {
    it("should use default prefix 'pedidos'", () => {
      const filename = generateCsvFilename();
      expect(filename).toMatch(/^pedidos-\d{4}-\d{2}-\d{2}-/);
      expect(filename).toMatch(/\.csv$/);
    });

    it("should use custom prefix", () => {
      const filename = generateCsvFilename("relatorio");
      expect(filename).toMatch(/^relatorio-/);
    });
  });
});
