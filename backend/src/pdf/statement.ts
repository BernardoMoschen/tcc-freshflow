import PDFDocument from "pdfkit";
import { prisma } from "../db/prisma.js";
import { calculateOrderTotals, formatPrice } from "../lib/price-engine.js";

/**
 * Generate delivery note PDF for an order
 * Format: "Extrato de Conferência" (Delivery Statement)
 */
export async function generateDeliveryNotePDF(orderId: string): Promise<Buffer> {
  // Fetch order with all details
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
        orderBy: {
          createdAt: "asc",
        },
      },
      customer: {
        include: {
          account: {
            include: {
              tenant: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  // Calculate totals
  const totals = await calculateOrderTotals(orderId);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const buffers: Buffer[] = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on("error", reject);

      // Header
      doc.fontSize(20).font("Helvetica-Bold").text("Extrato de Conferência", {
        align: "center",
      });

      doc.moveDown(0.5);

      // Order info
      doc.fontSize(10).font("Helvetica");
      doc.text(`Pedido: ${order.orderNumber}`, { align: "center" });
      doc.text(
        `Data: ${new Date(order.createdAt).toLocaleDateString("pt-BR")}`,
        { align: "center" }
      );
      doc.text(`Cliente: ${order.customer.account.name}`, { align: "center" });
      doc.text(`Fornecedor: ${order.customer.account.tenant.name}`, {
        align: "center",
      });

      doc.moveDown(1);

      // Table header
      const tableTop = doc.y;
      const colWidths = {
        product: 180,
        requestedQty: 80,
        actualWeight: 80,
        unitPrice: 80,
        total: 80,
      };

      doc.fontSize(9).font("Helvetica-Bold");

      let x = 50;
      doc.text("Produto", x, tableTop, { width: colWidths.product });
      x += colWidths.product;
      doc.text("Qtd. Solicitada", x, tableTop, { width: colWidths.requestedQty });
      x += colWidths.requestedQty;
      doc.text("Peso Real", x, tableTop, { width: colWidths.actualWeight });
      x += colWidths.actualWeight;
      doc.text("Preço Unit.", x, tableTop, { width: colWidths.unitPrice });
      x += colWidths.unitPrice;
      doc.text("Total", x, tableTop, { width: colWidths.total });

      // Line under header
      doc
        .moveTo(50, tableTop + 15)
        .lineTo(550, tableTop + 15)
        .stroke();

      doc.moveDown(1);

      // Table rows
      doc.font("Helvetica").fontSize(8);

      for (const item of order.items) {
        const y = doc.y;

        // Product name
        x = 50;
        const productName = `${item.productOption.product.name} - ${item.productOption.name}`;
        doc.text(productName, x, y, {
          width: colWidths.product,
          ellipsis: true,
        });

        // Requested quantity
        x += colWidths.product;
        const requestedQtyText =
          item.productOption.unitType === "FIXED"
            ? `${item.requestedQty} un`
            : `${item.requestedQty} kg`;
        doc.text(requestedQtyText, x, y, { width: colWidths.requestedQty });

        // Actual weight (for WEIGHT items)
        x += colWidths.requestedQty;
        const actualWeightText = item.actualWeight
          ? `${item.actualWeight} kg`
          : "-";
        doc.text(actualWeightText, x, y, { width: colWidths.actualWeight });

        // Unit price
        x += colWidths.actualWeight;
        const unitPriceText = item.finalPrice
          ? formatPrice(item.finalPrice)
          : "-";
        doc.text(unitPriceText, x, y, { width: colWidths.unitPrice });

        // Total
        x += colWidths.unitPrice;
        let itemTotal = 0;
        if (item.productOption.unitType === "FIXED" && item.finalPrice) {
          itemTotal = item.finalPrice;
        } else if (
          item.productOption.unitType === "WEIGHT" &&
          item.actualWeight &&
          item.finalPrice
        ) {
          itemTotal = item.actualWeight * item.finalPrice;
        }
        doc.text(formatPrice(itemTotal), x, y, { width: colWidths.total });

        doc.moveDown(0.8);

        // Add page break if needed
        if (doc.y > 700) {
          doc.addPage();
        }
      }

      doc.moveDown(1);

      // Line before subtotals
      doc
        .moveTo(350, doc.y)
        .lineTo(550, doc.y)
        .stroke();

      doc.moveDown(0.5);

      // Subtotals
      doc.fontSize(9).font("Helvetica");

      const subtotalsX = 350;
      const valuesX = 480;

      doc.text("Subtotal Fixos:", subtotalsX, doc.y);
      doc.text(formatPrice(totals.fixedTotal), valuesX, doc.y, { align: "right" });
      doc.moveDown(0.5);

      doc.text("Subtotal Pesáveis:", subtotalsX, doc.y);
      doc.text(formatPrice(totals.weightTotal), valuesX, doc.y, {
        align: "right",
      });
      doc.moveDown(0.5);

      // Line before grand total
      doc
        .moveTo(350, doc.y)
        .lineTo(550, doc.y)
        .stroke();

      doc.moveDown(0.5);

      // Grand total
      doc.fontSize(11).font("Helvetica-Bold");
      doc.text("TOTAL:", subtotalsX, doc.y);
      doc.text(formatPrice(totals.total), valuesX, doc.y, { align: "right" });

      doc.moveDown(2);

      // Signature area
      doc.fontSize(9).font("Helvetica");
      doc.moveDown(3);

      const signatureY = doc.y;
      doc.text("________________________________", 50, signatureY);
      doc.text("________________________________", 320, signatureY);

      doc.moveDown(0.5);
      doc.text("Assinatura do Fornecedor", 50, doc.y);
      doc.text("Assinatura do Cliente", 320, doc.y);

      // Footer
      doc.fontSize(8).font("Helvetica");
      doc.text(
        `Documento gerado em ${new Date().toLocaleString("pt-BR")}`,
        50,
        750,
        { align: "center" }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
