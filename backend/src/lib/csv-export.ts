import { Order, OrderItem, OrderStatus } from "@prisma/client";

/**
 * Extended order type with all relationships for export
 */
type OrderForExport = Order & {
  items: (OrderItem & {
    productOption: {
      name: string;
      sku: string;
      product: {
        name: string;
        category: string | null;
      };
    };
  })[];
  customer: {
    account: {
      name: string;
    };
  };
  createdByUser: {
    name: string | null;
    email: string;
  };
};

/**
 * Format currency value in centavos to BRL string
 */
function formatCurrency(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2)}`;
}

/**
 * Format date to BR format
 */
function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Escape CSV field (handle commas, quotes, newlines)
 */
function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);

  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Status labels in Portuguese
 */
const statusLabels: Record<OrderStatus, string> = {
  [OrderStatus.DRAFT]: "Rascunho",
  [OrderStatus.SENT]: "Enviado",
  [OrderStatus.IN_SEPARATION]: "Em Separação",
  [OrderStatus.FINALIZED]: "Finalizado",
};

/**
 * Generate CSV content for orders
 */
export function generateOrdersCsv(orders: OrderForExport[]): string {
  // CSV Headers
  const headers = [
    "Número do Pedido",
    "Status",
    "Cliente",
    "Criado por",
    "Data de Criação",
    "Data de Envio",
    "Data de Finalização",
    "Produto",
    "Categoria",
    "SKU",
    "Opção",
    "Quantidade Solicitada",
    "Quantidade Final",
    "Preço Unitário",
    "Preço Total",
    "Extra",
    "Observações",
  ];

  const rows: string[] = [headers.map(escapeCsvField).join(",")];

  // Generate rows (one per order item)
  for (const order of orders) {
    // If order has no items, still show order info
    if (order.items.length === 0) {
      rows.push(
        [
          escapeCsvField(order.orderNumber),
          escapeCsvField(statusLabels[order.status]),
          escapeCsvField(order.customer.account.name),
          escapeCsvField(order.createdByUser.name || order.createdByUser.email),
          escapeCsvField(formatDate(order.createdAt)),
          escapeCsvField(formatDate(order.sentAt)),
          escapeCsvField(formatDate(order.finalizedAt)),
          "", // Product
          "", // Category
          "", // SKU
          "", // Option
          "", // Requested Qty
          "", // Final Qty
          "", // Unit Price
          "", // Total Price
          "", // Extra
          escapeCsvField(order.notes || ""),
        ].join(",")
      );
    } else {
      // One row per item
      for (const item of order.items) {
        const finalQty = item.actualWeight || item.requestedQty;
        const unitPrice = item.finalPrice
          ? formatCurrency(Math.round(item.finalPrice / finalQty))
          : "";
        const totalPrice = item.finalPrice ? formatCurrency(item.finalPrice) : "";

        rows.push(
          [
            escapeCsvField(order.orderNumber),
            escapeCsvField(statusLabels[order.status]),
            escapeCsvField(order.customer.account.name),
            escapeCsvField(order.createdByUser.name || order.createdByUser.email),
            escapeCsvField(formatDate(order.createdAt)),
            escapeCsvField(formatDate(order.sentAt)),
            escapeCsvField(formatDate(order.finalizedAt)),
            escapeCsvField(item.productOption.product.name),
            escapeCsvField(item.productOption.product.category || ""),
            escapeCsvField(item.productOption.sku),
            escapeCsvField(item.productOption.name),
            escapeCsvField(item.requestedQty),
            escapeCsvField(item.actualWeight || ""),
            escapeCsvField(unitPrice),
            escapeCsvField(totalPrice),
            escapeCsvField(item.isExtra ? "Sim" : "Não"),
            escapeCsvField(order.notes || ""),
          ].join(",")
        );
      }
    }
  }

  return rows.join("\n");
}

/**
 * Generate filename for CSV export
 */
export function generateCsvFilename(prefix: string = "pedidos"): string {
  const date = new Date().toISOString().split("T")[0];
  const time = new Date().toTimeString().split(" ")[0].replace(/:/g, "-");
  return `${prefix}-${date}-${time}.csv`;
}
