import { OrderRepository, orderRepository } from "../repositories/order.repository.js";
import { StockService, stockService } from "./stock.service.js";
import { prisma } from "../db/prisma.js";
import { Errors } from "../lib/errors.js";
import { OrderStatus } from "@prisma/client";
import {
  resolvePrice,
  calculateFixedItemPrice,
  persistCustomerPrice,
} from "../lib/price-engine.js";
import {
  generateOrderNumber,
  validateOrderCanFinalize,
  validateCanWeighItem,
} from "../lib/order-state.js";
import {
  sendOrderCreatedNotification,
  sendOrderFinalizedNotification,
  OrderWithItems,
} from "../lib/whatsapp.js";
import { logger } from "../lib/logger.js";

export interface CreateOrderInput {
  accountId: string;
  customerId: string;
  createdBy: string;
  notes?: string;
  items: Array<{
    productOptionId: string;
    requestedQty: number;
    isExtra?: boolean;
  }>;
}

export interface WeighItemInput {
  orderItemId: string;
  actualWeight: number;
  finalPrice?: number;
  notes?: string;
  photoUrl?: string;
  persistPrice?: boolean;
  userId: string;
}

/**
 * Service layer for order management business logic
 */
export class OrderService {
  constructor(
    private orderRepo: OrderRepository = orderRepository,
    private stockSvc: StockService = stockService
  ) {}

  /**
   * Create a new order (status: SENT, immutable)
   */
  async create(input: CreateOrderInput) {
    // Validate customer exists
    const customer = await prisma.customer.findUnique({
      where: { accountId: input.accountId },
    });

    if (!customer) {
      throw Errors.notFound("Customer for account", input.accountId);
    }

    // Validate all product options exist
    const productOptions = await prisma.productOption.findMany({
      where: {
        id: { in: input.items.map((item) => item.productOptionId) },
      },
    });

    if (productOptions.length !== input.items.length) {
      throw Errors.badRequest("One or more product options not found");
    }

    // Calculate prices for items
    const orderItems = await Promise.all(
      input.items.map(async (item) => {
        const productOption = productOptions.find(
          (po) => po.id === item.productOptionId
        );

        let finalPrice: number | null = null;

        if (productOption!.unitType === "FIXED") {
          finalPrice = await calculateFixedItemPrice(
            item.productOptionId,
            item.requestedQty,
            customer.id
          );
        }

        return {
          productOptionId: item.productOptionId,
          requestedQty: item.requestedQty,
          finalPrice,
          isExtra: item.isExtra ?? false,
        };
      })
    );

    // Generate order number
    const orderNumber = generateOrderNumber();

    // Create order
    const order = await this.orderRepo.create({
      accountId: input.accountId,
      customerId: customer.id,
      createdBy: input.createdBy,
      orderNumber,
      notes: input.notes,
      items: orderItems,
    });

    // Send notification (non-blocking)
    this.sendOrderCreatedNotification(order).catch((err) =>
      logger.error("Failed to send order notification:", err)
    );

    return order;
  }

  /**
   * Get or create draft order for a user
   */
  async getDraft(accountId: string, userId: string) {
    const customer = await prisma.customer.findUnique({
      where: { accountId },
    });

    if (!customer) {
      throw Errors.notFound("Customer for account", accountId);
    }

    return this.orderRepo.getOrCreateDraft(accountId, customer.id, userId);
  }

  /**
   * Update draft order items
   */
  async updateDraft(
    orderId: string,
    accountId: string,
    userId: string,
    items: Array<{ productOptionId: string; requestedQty: number }>,
    notes?: string
  ) {
    // Verify order is draft and belongs to user
    const order = await this.orderRepo.getById(orderId);

    if (!order) {
      throw Errors.notFound("Order", orderId);
    }

    if (order.status !== OrderStatus.DRAFT) {
      throw Errors.badRequest("Can only update draft orders");
    }

    if (order.accountId !== accountId || order.createdBy !== userId) {
      throw Errors.forbidden("Not authorized to update this order");
    }

    // Get customer
    const customer = await prisma.customer.findUnique({
      where: { accountId },
    });

    if (!customer) {
      throw Errors.notFound("Customer", accountId);
    }

    // Validate product options
    const productOptions = await prisma.productOption.findMany({
      where: {
        id: { in: items.map((item) => item.productOptionId) },
      },
    });

    if (productOptions.length !== items.length) {
      throw Errors.badRequest("One or more product options not found");
    }

    // Calculate prices
    const orderItems = await Promise.all(
      items.map(async (item) => {
        const productOption = productOptions.find(
          (po) => po.id === item.productOptionId
        );

        let finalPrice: number | null = null;

        if (productOption!.unitType === "FIXED") {
          finalPrice = await calculateFixedItemPrice(
            item.productOptionId,
            item.requestedQty,
            customer.id
          );
        }

        return {
          productOptionId: item.productOptionId,
          requestedQty: item.requestedQty,
          finalPrice,
        };
      })
    );

    return this.orderRepo.updateDraft({
      orderId,
      items: orderItems,
      notes,
    });
  }

  /**
   * Submit draft order (convert to SENT)
   */
  async submitDraft(orderId: string, accountId: string, userId: string) {
    const order = await this.orderRepo.getById(orderId);

    if (!order) {
      throw Errors.notFound("Order", orderId);
    }

    if (order.status !== OrderStatus.DRAFT) {
      throw Errors.badRequest("Can only submit draft orders");
    }

    if (order.accountId !== accountId || order.createdBy !== userId) {
      throw Errors.forbidden("Not authorized to submit this order");
    }

    if (order.items.length === 0) {
      throw Errors.badRequest("Cannot submit empty order");
    }

    // Validate stock
    const stockValidation = await this.stockSvc.validateStockForOrder(orderId);
    if (!stockValidation.isValid) {
      const details = stockValidation.insufficientItems
        .map((item) => `${item.productName}: needs ${item.required}, only ${item.available}`)
        .join("; ");
      throw Errors.badRequest(`Insufficient stock: ${details}`);
    }

    // Generate proper order number
    const orderNumber = generateOrderNumber();

    // Submit
    const submittedOrder = await this.orderRepo.submitDraft(orderId, orderNumber);

    // Send notification (non-blocking)
    this.sendOrderCreatedNotification(submittedOrder).catch((err) =>
      logger.error("Failed to send order notification:", err)
    );

    return submittedOrder;
  }

  /**
   * Clear draft order
   */
  async clearDraft(orderId: string, accountId: string, userId: string) {
    const order = await this.orderRepo.getById(orderId);

    if (!order) {
      throw Errors.notFound("Order", orderId);
    }

    if (order.status !== OrderStatus.DRAFT) {
      throw Errors.badRequest("Can only clear draft orders");
    }

    if (order.accountId !== accountId || order.createdBy !== userId) {
      throw Errors.forbidden("Not authorized to clear this order");
    }

    return this.orderRepo.clearDraft(orderId);
  }

  /**
   * Get order by ID
   */
  async getById(id: string) {
    const order = await this.orderRepo.getById(id);

    if (!order) {
      throw Errors.notFound("Order", id);
    }

    return order;
  }

  /**
   * List orders with filtering
   */
  async list(params: {
    accountId?: string;
    status?: OrderStatus;
    skip?: number;
    take?: number;
  }) {
    return this.orderRepo.list(params);
  }

  /**
   * Weigh an order item
   */
  async weighItem(input: WeighItemInput) {
    // Get order item with order and product option
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: input.orderItemId },
      include: {
        order: {
          include: {
            customer: true,
          },
        },
        productOption: true,
      },
    });

    if (!orderItem) {
      throw Errors.notFound("Order item", input.orderItemId);
    }

    // Validate can weigh
    validateCanWeighItem(orderItem.order, orderItem);

    // Resolve price
    let pricePerKg: number;
    if (input.finalPrice) {
      pricePerKg = input.finalPrice;
    } else {
      pricePerKg = await resolvePrice(
        orderItem.productOptionId,
        orderItem.order.customerId
      );
    }

    // Create weighing record
    const result = await this.orderRepo.createWeighing({
      orderItemId: input.orderItemId,
      actualWeight: input.actualWeight,
      finalPrice: pricePerKg,
      notes: input.notes,
      photoUrl: input.photoUrl,
      userId: input.userId,
    });

    // Persist customer price if requested
    if (input.persistPrice && input.finalPrice) {
      await persistCustomerPrice(
        orderItem.order.customerId,
        orderItem.productOptionId,
        input.finalPrice
      );
    }

    return result.orderItem;
  }

  /**
   * Add item to order
   */
  async addItem(params: {
    orderId: string;
    productOptionId: string;
    requestedQty: number;
    isExtra?: boolean;
  }) {
    const order = await this.orderRepo.getById(params.orderId);

    if (!order) {
      throw Errors.notFound("Order", params.orderId);
    }

    if (order.status === OrderStatus.FINALIZED) {
      throw Errors.badRequest("Cannot add items to finalized order");
    }

    const productOption = await prisma.productOption.findUnique({
      where: { id: params.productOptionId },
    });

    if (!productOption) {
      throw Errors.notFound("Product option", params.productOptionId);
    }

    // Calculate finalPrice for FIXED items
    let finalPrice: number | null = null;
    if (productOption.unitType === "FIXED") {
      finalPrice = await calculateFixedItemPrice(
        params.productOptionId,
        params.requestedQty,
        order.customerId
      );
    }

    return this.orderRepo.addItem({
      orderId: params.orderId,
      productOptionId: params.productOptionId,
      requestedQty: params.requestedQty,
      finalPrice,
      isExtra: params.isExtra ?? true,
    });
  }

  /**
   * Remove item from order
   */
  async removeItem(orderItemId: string) {
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true },
    });

    if (!orderItem) {
      throw Errors.notFound("Order item", orderItemId);
    }

    if (orderItem.order.status === OrderStatus.FINALIZED) {
      throw Errors.badRequest("Cannot remove items from finalized orders");
    }

    return this.orderRepo.removeItem(orderItemId);
  }

  /**
   * Finalize order
   */
  async finalize(orderId: string, userId: string) {
    const order = await this.orderRepo.getById(orderId);

    if (!order) {
      throw Errors.notFound("Order", orderId);
    }

    // Validate can finalize
    validateOrderCanFinalize(order);

    // Validate and deduct stock
    await this.stockSvc.deductStockForOrder(orderId, userId);

    // Finalize order
    const finalizedOrder = await this.orderRepo.finalize(orderId);

    // Calculate total
    const totalAmount = finalizedOrder.items.reduce(
      (sum, item) => sum + (item.finalPrice || 0),
      0
    );

    // Send notification (non-blocking)
    this.sendOrderFinalizedNotification(finalizedOrder, totalAmount).catch((err) =>
      logger.error("Failed to send finalization notification:", err)
    );

    return finalizedOrder;
  }

  /**
   * Cancel order (with stock restoration if finalized)
   */
  async cancel(orderId: string, userId: string, reason?: string) {
    const order = await this.orderRepo.getById(orderId);

    if (!order) {
      throw Errors.notFound("Order", orderId);
    }

    // Restore stock if order was finalized
    if (order.status === OrderStatus.FINALIZED) {
      await this.stockSvc.restoreStockForOrder(orderId, userId, reason);
    }

    return this.orderRepo.cancel(orderId);
  }

  /**
   * Bulk update order status
   */
  async bulkUpdateStatus(orderIds: string[], status: OrderStatus, userId: string) {
    // Validate all orders exist and can be updated
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: {
        items: {
          include: { productOption: true },
        },
      },
    });

    if (orders.length !== orderIds.length) {
      throw Errors.badRequest("Some orders not found");
    }

    // Validate transitions
    for (const order of orders) {
      if (status === OrderStatus.FINALIZED && order.status !== OrderStatus.IN_SEPARATION) {
        throw Errors.badRequest(
          `Order ${order.orderNumber} must be in separation before finalizing`
        );
      }
    }

    // Handle stock deduction for finalization
    if (status === OrderStatus.FINALIZED) {
      for (const order of orders) {
        if (order.status !== OrderStatus.FINALIZED) {
          await this.stockSvc.deductStockForOrder(order.id, userId);
        }
      }
    }

    return this.orderRepo.bulkUpdateStatus(orderIds, status);
  }

  /**
   * Send order created notification
   */
  private async sendOrderCreatedNotification(order: OrderWithItems) {
    const phoneNumber = process.env.WHATSAPP_DEFAULT_PHONE;
    if (!phoneNumber) return;

    await sendOrderCreatedNotification(
      phoneNumber,
      order,
      (order as OrderWithItems & { customer?: { account?: { name?: string } } }).customer?.account?.name || "Unknown"
    );
  }

  /**
   * Send order finalized notification
   */
  private async sendOrderFinalizedNotification(order: OrderWithItems, totalAmount: number) {
    const phoneNumber = process.env.WHATSAPP_DEFAULT_PHONE;
    if (!phoneNumber) return;

    const pdfUrl = process.env.API_BASE_URL
      ? `${process.env.API_BASE_URL}/api/delivery-note/${order.id}.pdf`
      : undefined;

    await sendOrderFinalizedNotification(
      phoneNumber,
      order,
      (order as OrderWithItems & { customer?: { account?: { name?: string } } }).customer?.account?.name || "Unknown",
      totalAmount,
      pdfUrl
    );
  }
}

// Export singleton instance
export const orderService = new OrderService();
