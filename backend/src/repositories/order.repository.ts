import { PrismaClient, OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";

export interface CreateOrderInput {
  accountId: string;
  customerId: string;
  createdBy: string;
  orderNumber: string;
  notes?: string;
  items: Array<{
    productOptionId: string;
    requestedQty: number;
    finalPrice: number | null;
    isExtra?: boolean;
  }>;
}

export interface UpdateDraftInput {
  orderId: string;
  items: Array<{
    productOptionId: string;
    requestedQty: number;
    finalPrice: number | null;
  }>;
  notes?: string;
}

/**
 * Repository for order-related database operations
 */
export class OrderRepository {
  constructor(private db: PrismaClient = prisma) {}

  private readonly orderInclude = {
    items: {
      include: {
        productOption: {
          include: {
            product: true,
          },
        },
        weighings: {
          orderBy: { createdAt: "desc" as const },
        },
      },
    },
    customer: {
      include: {
        account: true,
        customerPrices: true,
      },
    },
    createdByUser: true,
  };

  /**
   * Create a new order with items
   */
  async create(input: CreateOrderInput) {
    return this.db.order.create({
      data: {
        orderNumber: input.orderNumber,
        customerId: input.customerId,
        accountId: input.accountId,
        createdBy: input.createdBy,
        status: OrderStatus.SENT,
        sentAt: new Date(),
        notes: input.notes,
        items: {
          create: input.items,
        },
      },
      include: this.orderInclude,
    });
  }

  /**
   * Get or create draft order for a user
   */
  async getOrCreateDraft(accountId: string, customerId: string, createdBy: string) {
    // Find existing draft
    let draft = await this.db.order.findFirst({
      where: {
        accountId,
        status: OrderStatus.DRAFT,
        createdBy,
      },
      include: this.orderInclude,
      orderBy: { updatedAt: "desc" },
    });

    if (!draft) {
      draft = await this.db.order.create({
        data: {
          orderNumber: `DRAFT-${Date.now()}`,
          accountId,
          customerId,
          status: OrderStatus.DRAFT,
          createdBy,
        },
        include: this.orderInclude,
      });
    }

    return draft;
  }

  /**
   * Update draft order items atomically
   */
  async updateDraft(input: UpdateDraftInput) {
    return this.db.$transaction(async (tx) => {
      // Delete existing items
      await tx.orderItem.deleteMany({
        where: { orderId: input.orderId },
      });

      // Update order with new items
      return tx.order.update({
        where: { id: input.orderId },
        data: {
          notes: input.notes,
          items: {
            create: input.items,
          },
        },
        include: this.orderInclude,
      });
    });
  }

  /**
   * Submit draft order (convert to SENT)
   */
  async submitDraft(orderId: string, orderNumber: string) {
    return this.db.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.SENT,
        orderNumber,
        sentAt: new Date(),
      },
      include: this.orderInclude,
    });
  }

  /**
   * Clear all items from draft order
   */
  async clearDraft(orderId: string) {
    await this.db.orderItem.deleteMany({
      where: { orderId },
    });
    return { success: true };
  }

  /**
   * Get order by ID with all relations
   */
  async getById(id: string) {
    return this.db.order.findUnique({
      where: { id },
      include: this.orderInclude,
    });
  }

  /**
   * List orders with filtering and pagination
   */
  async list(params: {
    accountId?: string;
    status?: OrderStatus;
    skip?: number;
    take?: number;
  }) {
    const { accountId, status, skip = 0, take = 20 } = params;

    const where: any = {};
    if (accountId) where.accountId = accountId;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.db.order.findMany({
        where,
        skip,
        take,
        include: this.orderInclude,
        orderBy: { createdAt: "desc" },
      }),
      this.db.order.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Finalize order with pessimistic locking
   */
  async finalize(orderId: string) {
    return this.db.$transaction(async (tx) => {
      // Lock the order row
      const [locked] = await tx.$queryRaw<Array<{ id: string; status: OrderStatus }>>`
        SELECT id, status
        FROM "Order"
        WHERE id = ${orderId}::uuid
        FOR UPDATE
      `;

      if (!locked) {
        throw new Error(`Order not found: ${orderId}`);
      }

      if (locked.status === OrderStatus.FINALIZED) {
        throw new Error("Order is already finalized");
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.FINALIZED,
          finalizedAt: new Date(),
        },
        include: this.orderInclude,
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Cancel order
   */
  async cancel(orderId: string) {
    await this.db.order.delete({
      where: { id: orderId },
    });
    return { success: true };
  }

  /**
   * Bulk update order status
   */
  async bulkUpdateStatus(orderIds: string[], status: OrderStatus) {
    const result = await this.db.order.updateMany({
      where: { id: { in: orderIds } },
      data: {
        status,
        ...(status === OrderStatus.FINALIZED && { finalizedAt: new Date() }),
      },
    });

    return { updated: result.count };
  }

  /**
   * Add item to order
   */
  async addItem(params: {
    orderId: string;
    productOptionId: string;
    requestedQty: number;
    finalPrice: number | null;
    isExtra?: boolean;
  }) {
    return this.db.orderItem.create({
      data: {
        orderId: params.orderId,
        productOptionId: params.productOptionId,
        requestedQty: params.requestedQty,
        finalPrice: params.finalPrice,
        isExtra: params.isExtra ?? false,
      },
      include: {
        productOption: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  /**
   * Remove item from order
   */
  async removeItem(orderItemId: string) {
    await this.db.orderItem.delete({
      where: { id: orderItemId },
    });
    return { success: true };
  }

  /**
   * Update order item
   */
  async updateItem(orderItemId: string, data: {
    requestedQty?: number;
    actualWeight?: number;
    finalPrice?: number;
    notes?: string;
  }) {
    return this.db.orderItem.update({
      where: { id: orderItemId },
      data,
      include: {
        productOption: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  /**
   * Create weighing record
   */
  async createWeighing(params: {
    orderItemId: string;
    actualWeight: number;
    finalPrice: number;
    notes?: string;
    photoUrl?: string;
    userId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      // Create weighing record
      const weighing = await tx.weighing.create({
        data: {
          orderItemId: params.orderItemId,
          actualWeight: params.actualWeight,
          finalPrice: params.finalPrice,
          notes: params.notes,
          photoUrl: params.photoUrl,
          userId: params.userId,
        },
      });

      // Update order item
      const orderItem = await tx.orderItem.update({
        where: { id: params.orderItemId },
        data: {
          actualWeight: params.actualWeight,
          finalPrice: params.finalPrice,
        },
        include: {
          productOption: {
            include: {
              product: true,
            },
          },
          weighings: true,
        },
      });

      return { weighing, orderItem };
    });
  }
}

// Export singleton instance
export const orderRepository = new OrderRepository();
