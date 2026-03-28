import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, accountProcedure, tenantAdminProcedure } from "../trpc.js";
import { OrderStatus, Prisma } from "@prisma/client";
import { logger } from "../lib/logger.js";
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
} from "../lib/whatsapp.js";
import {
  validateStockAvailability,
  deductStockForOrder,
} from "../lib/stock-manager.js";
import { checkRateLimit, procedureRateLimits } from "../middleware/rate-limit.js";
import { orderEvents, OrderEventType } from "../lib/event-emitter.js";
import { generateOrdersCsv, generateCsvFilename } from "../lib/csv-export.js";
import { ActivityService } from "../services/activity.service.js";

export const ordersRouter = router({
  /**
   * Get or create draft order for current account
   * Uses optimistic locking to handle race conditions
   */
  getDraft: accountProcedure.query(async ({ ctx }) => {
    // Rate limit to prevent rapid duplicate calls
    checkRateLimit(`draft:get:${ctx.userId}:${ctx.accountId}`, procedureRateLimits.draftOrder);

    // Get customer for this account
    const customer = await ctx.prisma.customer.findUnique({
      where: { accountId: ctx.accountId },
    });

    if (!customer) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Customer not found for this account",
      });
    }

    const draftInclude = {
      items: {
        include: {
          productOption: {
            include: {
              product: true,
            },
          },
        },
      },
      customer: {
        include: {
          account: true,
        },
      },
    };

    // Find existing draft order
    let draftOrder = await ctx.prisma.order.findFirst({
      where: {
        accountId: ctx.accountId,
        status: OrderStatus.DRAFT,
        createdBy: ctx.userId,
      },
      include: draftInclude,
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Create draft order if doesn't exist
    if (!draftOrder) {
      try {
        // Use a unique order number with random suffix to prevent collisions
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        draftOrder = await ctx.prisma.order.create({
          data: {
            orderNumber: `DRAFT-${uniqueId}`,
            accountId: ctx.accountId,
            customerId: customer.id,
            status: OrderStatus.DRAFT,
            createdBy: ctx.userId,
          },
          include: draftInclude,
        });
      } catch (error: unknown) {
        // Handle race condition: if another request created a draft simultaneously,
        // try to find it instead of throwing
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2002"
        ) {
          // Unique constraint violation - another draft was created, fetch it
          draftOrder = await ctx.prisma.order.findFirst({
            where: {
              accountId: ctx.accountId,
              status: OrderStatus.DRAFT,
              createdBy: ctx.userId,
            },
            include: draftInclude,
            orderBy: {
              updatedAt: "desc",
            },
          });

          if (!draftOrder) {
            // This shouldn't happen, but if it does, throw original error
            throw error;
          }
        } else {
          throw error;
        }
      }
    }

    return draftOrder;
  }),

  /**
   * Update draft order items
   */
  updateDraft: accountProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        items: z.array(
          z.object({
            productOptionId: z.string().uuid(),
            requestedQty: z.number().positive(),
            notes: z.string().optional().nullable(),
          })
        ),
        notes: z.string().optional(),
        requestedDeliveryDate: z.string().optional(),
        deliveryTimeSlot: z.string().optional(),
        deliveryInstructions: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify order is draft and belongs to user
      const order = await ctx.prisma.order.findUnique({
        where: { id: input.orderId },
        include: { items: true },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      if (order.status !== OrderStatus.DRAFT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only update draft orders",
        });
      }

      if (order.accountId !== ctx.accountId || order.createdBy !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to update this order",
        });
      }

      // Get customer
      const customer = await ctx.prisma.customer.findUnique({
        where: { accountId: ctx.accountId },
      });

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found",
        });
      }

      // Delete existing items and create new ones
      await ctx.prisma.orderItem.deleteMany({
        where: { orderId: input.orderId },
      });

      // Validate product options and calculate prices
      const productOptions = await ctx.prisma.productOption.findMany({
        where: {
          id: { in: input.items.map((item) => item.productOptionId) },
        },
      });

      if (productOptions.length !== input.items.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more product options not found",
        });
      }

      // Create new items with resolved prices
      const orderItems = await Promise.all(
        input.items.map(async (item) => {
          const productOption = productOptions.find(
            (po) => po.id === item.productOptionId
          );

          if (!productOption) {
            throw new Error("Product option not found");
          }

          let finalPrice: number | null = null;

          if (productOption.unitType === "FIXED") {
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
            notes: item.notes,
          };
        })
      );

      // Update order
      const updatedOrder = await ctx.prisma.order.update({
        where: { id: input.orderId },
        data: {
          notes: input.notes,
          requestedDeliveryDate: input.requestedDeliveryDate ? new Date(input.requestedDeliveryDate) : undefined,
          deliveryTimeSlot: input.deliveryTimeSlot,
          deliveryInstructions: input.deliveryInstructions,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: {
            include: {
              productOption: {
                include: {
                  product: true,
                },
              },
            },
          },
          customer: {
            include: {
              account: true,
            },
          },
        },
      });

      return updatedOrder;
    }),

  /**
   * Submit draft order (converts to SENT status)
   */
  submitDraft: accountProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        notes: z.string().optional(),
        requestedDeliveryDate: z.string().optional(), // ISO date string
        deliveryTimeSlot: z.string().optional(),
        deliveryInstructions: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify order is draft and belongs to user
      const order = await ctx.prisma.order.findUnique({
        where: { id: input.orderId },
        include: { items: true },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      if (order.status !== OrderStatus.DRAFT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only submit draft orders",
        });
      }

      if (order.accountId !== ctx.accountId || order.createdBy !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to submit this order",
        });
      }

      if (order.items.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot submit empty order",
        });
      }

      // Validate stock availability
      await validateStockAvailability(ctx.prisma, input.orderId);

      // Generate proper order number
      const orderNumber = generateOrderNumber();

      // Update order status to SENT
      const submittedOrder = await ctx.prisma.order.update({
        where: { id: input.orderId },
        data: {
          status: OrderStatus.SENT,
          orderNumber,
          sentAt: new Date(),
          notes: input.notes,
          requestedDeliveryDate: input.requestedDeliveryDate
            ? new Date(input.requestedDeliveryDate)
            : undefined,
          deliveryTimeSlot: input.deliveryTimeSlot,
          deliveryInstructions: input.deliveryInstructions,
        },
        include: {
          items: {
            include: {
              productOption: {
                include: {
                  product: true,
                },
              },
            },
          },
          customer: {
            include: {
              account: true,
            },
          },
          createdByUser: true,
        },
      });

      // Log activity
      const activityService = new ActivityService(ctx.prisma);
      await activityService.logOrderSubmitted(input.orderId, ctx.userId, orderNumber);

      if (input.requestedDeliveryDate) {
        await activityService.logDeliveryScheduled(
          input.orderId,
          ctx.userId,
          new Date(input.requestedDeliveryDate),
          input.deliveryTimeSlot
        );
      }

      if (input.notes) {
        await activityService.logNoteAdded(input.orderId, ctx.userId, input.notes);
      }

      // Send WhatsApp notification
      try {
        const phoneNumber = process.env.WHATSAPP_DEFAULT_PHONE;
        if (phoneNumber) {
          await sendOrderCreatedNotification(
            phoneNumber,
            submittedOrder,
            submittedOrder.customer.account.name
          );

          // Log notification
          await activityService.logNotificationSent(
            input.orderId,
            "Pedido Criado",
            phoneNumber
          );
        }
      } catch (error) {
        logger.error("Failed to send WhatsApp notification:", error);
      }

      return submittedOrder;
    }),

  /**
   * Clear draft order (delete all items)
   */
  clearDraft: accountProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify order is draft and belongs to user
      const order = await ctx.prisma.order.findUnique({
        where: { id: input.orderId },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      if (order.status !== OrderStatus.DRAFT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only clear draft orders",
        });
      }

      if (order.accountId !== ctx.accountId || order.createdBy !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to clear this order",
        });
      }

      // Delete all items
      await ctx.prisma.orderItem.deleteMany({
        where: { orderId: input.orderId },
      });

      return { success: true };
    }),

  /**
   * List orders with optional status filter
   */
  list: accountProcedure
    .input(
      z.object({
        status: z.nativeEnum(OrderStatus).optional(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { status, skip, take } = input;

      const where = {
        accountId: ctx.accountId,
        ...(status && { status }),
      };

      const [items, total] = await Promise.all([
        ctx.prisma.order.findMany({
          where,
          skip,
          take,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
            sentAt: true,
            finalizedAt: true,
            // Only get item count and minimal data for list view
            items: {
              select: {
                id: true,
                requestedQty: true,
                actualWeight: true,
                finalPrice: true,
                productOption: {
                  select: {
                    id: true,
                    name: true,
                    unitType: true,
                    product: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
            customer: {
              select: {
                id: true,
                account: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            createdByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                items: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        }),
        ctx.prisma.order.count({ where }),
      ]);

      return {
        items,
        total,
      };
    }),

  /**
   * List all orders for a tenant (tenant admin only)
   * This shows all orders across all accounts in the tenant
   */
  adminList: tenantAdminProcedure
    .input(
      z.object({
        status: z.nativeEnum(OrderStatus).optional(),
        search: z.string().optional(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { status, search, skip, take } = input;

      // Build where clause for orders in this tenant
      const where: Prisma.OrderWhereInput = {
        account: {
          tenantId: ctx.tenantId,
        },
        // Exclude draft orders from admin view
        status: status || { not: OrderStatus.DRAFT },
      };

      // Add search filter for order number or customer name
      if (search) {
        where.OR = [
          { orderNumber: { contains: search, mode: "insensitive" as const } },
          {
            customer: {
              account: {
                name: { contains: search, mode: "insensitive" as const },
              },
            },
          },
        ];
      }

      if (status) {
        where.status = status;
      }

      const [items, total] = await Promise.all([
        ctx.prisma.order.findMany({
          where,
          skip,
          take,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
            sentAt: true,
            finalizedAt: true,
            // Only get item count and minimal data for list view
            items: {
              select: {
                id: true,
                requestedQty: true,
                actualWeight: true,
                finalPrice: true,
                productOption: {
                  select: {
                    id: true,
                    name: true,
                    unitType: true,
                    product: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
            customer: {
              select: {
                id: true,
                account: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            createdByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                items: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        }),
        ctx.prisma.order.count({ where }),
      ]);

      return {
        items,
        total,
      };
    }),

  /**
   * Get single order with full details
   * Access: user must belong to order's account OR be tenant admin of order's tenant
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // SECURITY: First validate access with lightweight query BEFORE loading full data
      const orderAccess = await ctx.prisma.order.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          accountId: true,
          customer: {
            select: {
              account: {
                select: { tenantId: true },
              },
            },
          },
        },
      });

      if (!orderAccess) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      // Check 1: User belongs to the order's account
      const isAccountMember = ctx.accountId && orderAccess.accountId === ctx.accountId;

      // Check 2: User is a tenant admin for the order's tenant
      let isTenantAdmin = false;
      if (ctx.tenantId) {
        const membership = await ctx.prisma.membership.findFirst({
          where: {
            userId: ctx.userId,
            OR: [
              { tenantId: ctx.tenantId },
              { role: { name: "PLATFORM_ADMIN" } },
            ],
          },
          include: { role: true },
        });
        const adminRoles = ["PLATFORM_ADMIN", "TENANT_OWNER", "TENANT_ADMIN"];
        isTenantAdmin = !!membership && adminRoles.includes(membership.role.name);

        // Also verify order belongs to this tenant
        if (isTenantAdmin && orderAccess.customer.account.tenantId !== ctx.tenantId) {
          isTenantAdmin = false;
        }
      }

      if (!isAccountMember && !isTenantAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied to this order",
        });
      }

      // ONLY NOW load the full order data after access is verified
      const order = await ctx.prisma.order.findUnique({
        where: { id: input.id },
        include: {
          items: {
            include: {
              productOption: {
                include: {
                  product: true,
                },
              },
              weighings: {
                orderBy: {
                  createdAt: "desc",
                },
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
        },
      });

      return order;
    }),

  /**
   * Weigh order item (creates Weighing record, updates OrderItem) - tenant admin only
   */
  weigh: tenantAdminProcedure
    .input(
      z.object({
        orderItemId: z.string().uuid(),
        actualWeight: z.number().positive(),
        finalPrice: z.number().positive().optional(),
        notes: z.string().optional(),
        photoUrl: z.string().url().optional(),
        persistPrice: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get order item with order and product option
      const orderItem = await ctx.prisma.orderItem.findUnique({
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
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order item not found",
        });
      }

      // Validate can weigh this item
      validateCanWeighItem(orderItem.order, orderItem);

      // Resolve price (manual override or customer/base price)
      let pricePerKg: number;
      if (input.finalPrice) {
        pricePerKg = input.finalPrice;
      } else {
        pricePerKg = await resolvePrice(
          orderItem.productOptionId,
          orderItem.order.customerId
        );
      }

      // Create weighing record (audit log)
      await ctx.prisma.weighing.create({
        data: {
          orderItemId: input.orderItemId,
          actualWeight: input.actualWeight,
          finalPrice: pricePerKg,
          notes: input.notes,
          photoUrl: input.photoUrl,
          userId: ctx.userId,
        },
      });

      // Update order item with actual weight and final price
      const updatedOrderItem = await ctx.prisma.orderItem.update({
        where: { id: input.orderItemId },
        data: {
          actualWeight: input.actualWeight,
          finalPrice: pricePerKg,
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

      // Persist price as customer override if requested
      if (input.persistPrice && input.finalPrice) {
        await persistCustomerPrice(
          orderItem.order.customerId,
          orderItem.productOptionId,
          input.finalPrice
        );
      }

      return updatedOrderItem;
    }),

  /**
   * Add extra item to order (tenant admin only, before finalization)
   */
  addItem: tenantAdminProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        productOptionId: z.string().uuid(),
        requestedQty: z.number().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get order
      const order = await ctx.prisma.order.findUnique({
        where: { id: input.orderId },
        include: {
          customer: true,
        },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      // Cannot add items to finalized orders
      if (order.status === OrderStatus.FINALIZED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot add items to finalized order",
        });
      }

      // Get product option
      const productOption = await ctx.prisma.productOption.findUnique({
        where: { id: input.productOptionId },
      });

      if (!productOption) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product option not found",
        });
      }

      // Calculate finalPrice for FIXED items
      let finalPrice: number | null = null;
      if (productOption.unitType === "FIXED") {
        finalPrice = await calculateFixedItemPrice(
          input.productOptionId,
          input.requestedQty,
          order.customerId
        );
      }

      // Create order item
      const orderItem = await ctx.prisma.orderItem.create({
        data: {
          orderId: input.orderId,
          productOptionId: input.productOptionId,
          requestedQty: input.requestedQty,
          finalPrice,
          isExtra: true,
        },
        include: {
          productOption: {
            include: {
              product: true,
            },
          },
        },
      });

      return orderItem;
    }),

  /**
   * Finalize order (validates all WEIGHT items weighed, updates status) - tenant admin only
   */
  finalize: tenantAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Rate limit order finalization per user
      checkRateLimit(`order:finalize:${ctx.userId}`, procedureRateLimits.orderFinalize);

      // Get order with items
      const order = await ctx.prisma.order.findUnique({
        where: { id: input.id },
        include: {
          items: {
            include: {
              productOption: true,
            },
          },
        },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      // Validate can finalize
      validateOrderCanFinalize(order);

      // Validate stock availability
      await validateStockAvailability(ctx.prisma, input.id);

      // Deduct stock and create movement records
      await deductStockForOrder(ctx.prisma, input.id, ctx.userId);

      // Update order status to FINALIZED
      const finalizedOrder = await ctx.prisma.order.update({
        where: { id: input.id },
        data: {
          status: OrderStatus.FINALIZED,
          finalizedAt: new Date(),
        },
        include: {
          items: {
            include: {
              productOption: {
                include: {
                  product: true,
                },
              },
              weighings: true,
            },
          },
          customer: {
            include: {
              account: true,
            },
          },
        },
      });

      // Calculate total amount
      const totalAmount = finalizedOrder.items.reduce((sum, item) => {
        return sum + (item.finalPrice || 0);
      }, 0);

      // Send WhatsApp notification (if configured)
      const phoneNumber = process.env.WHATSAPP_DEFAULT_PHONE;
      if (phoneNumber) {
        try {
          // Generate PDF URL if available
          const pdfUrl = process.env.API_BASE_URL
            ? `${process.env.API_BASE_URL}/api/delivery-note/${finalizedOrder.id}.pdf`
            : undefined;

          await sendOrderFinalizedNotification(
            phoneNumber,
            finalizedOrder,
            finalizedOrder.customer.account.name,
            totalAmount,
            pdfUrl
          );
        } catch (error) {
          logger.error("Failed to send WhatsApp notification:", error);
          // Don't fail the finalization if notification fails
        }
      }

      // Emit real-time event
      orderEvents.emitOrderEvent({
        type: OrderEventType.FINALIZED,
        orderId: finalizedOrder.id,
        accountId: finalizedOrder.accountId,
        tenantId: finalizedOrder.customer.account.tenantId,
        status: finalizedOrder.status,
        data: { totalAmount },
        timestamp: new Date().toISOString(),
      });

      return finalizedOrder;
    }),

  /**
   * Remove item from order (tenant admin only, not FINALIZED)
   */
  removeItem: tenantAdminProcedure
    .input(
      z.object({
        orderItemId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orderItem = await ctx.prisma.orderItem.findUnique({
        where: { id: input.orderItemId },
        include: {
          order: true,
        },
      });

      if (!orderItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order item not found",
        });
      }

      // Cannot remove items from finalized orders
      if (orderItem.order.status === OrderStatus.FINALIZED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot remove items from finalized orders",
        });
      }

      await ctx.prisma.orderItem.delete({
        where: { id: input.orderItemId },
      });

      return { success: true };
    }),

  /**
   * Update order item quantity or notes (tenant admin only, not FINALIZED)
   */
  updateItem: tenantAdminProcedure
    .input(
      z.object({
        orderItemId: z.string().uuid(),
        requestedQty: z.number().positive().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orderItem = await ctx.prisma.orderItem.findUnique({
        where: { id: input.orderItemId },
        include: {
          order: true,
          productOption: true,
        },
      });

      if (!orderItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order item not found",
        });
      }

      // Cannot modify finalized orders
      if (orderItem.order.status === OrderStatus.FINALIZED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot modify finalized orders",
        });
      }

      const { orderItemId, ...updateData } = input;

      // If updating quantity and it's a FIXED item, update the requested quantity
      if (updateData.requestedQty && orderItem.productOption.unitType === "FIXED") {
        updateData.requestedQty = input.requestedQty!;
      }

      const updatedItem = await ctx.prisma.orderItem.update({
        where: { id: orderItemId },
        data: updateData,
        include: {
          productOption: {
            include: {
              product: true,
            },
          },
        },
      });

      return updatedItem;
    }),

  /**
   * Cancel an order (with stock reversal if finalized) - tenant admin only
   */
  cancel: tenantAdminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.prisma.order.findUnique({
        where: { id: input.id },
        include: {
          items: {
            include: {
              productOption: true,
            },
          },
        },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      // If order was finalized, reverse stock deductions
      if (order.status === OrderStatus.FINALIZED) {
        await ctx.prisma.$transaction(async (tx) => {
          for (const item of order.items) {
            const quantityToRestore =
              item.productOption.unitType === "WEIGHT" && item.actualWeight
                ? item.actualWeight
                : item.requestedQty;

            // Restore stock
            await tx.productOption.update({
              where: { id: item.productOptionId },
              data: {
                stockQuantity: {
                  increment: quantityToRestore,
                },
              },
            });

            // Create stock movement record
            await tx.stockMovement.create({
              data: {
                productOptionId: item.productOptionId,
                type: "RETURN" as any,
                quantity: quantityToRestore,
                orderId: order.id,
                orderItemId: item.id,
                notes: input.reason || `Order cancelled: ${order.orderNumber}`,
                userId: ctx.userId,
              },
            });
          }
        });
      }

      // Delete the order (cascades to items)
      await ctx.prisma.order.delete({
        where: { id: input.id },
      });

      return { success: true, message: "Order cancelled successfully" };
    }),

  /**
   * Bulk update order status - tenant admin only
   */
  bulkUpdateStatus: tenantAdminProcedure
    .input(
      z.object({
        orderIds: z.array(z.string().uuid()).min(1),
        status: z.nativeEnum(OrderStatus),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Rate limit bulk operations per user
      checkRateLimit(`order:bulk:${ctx.userId}`, procedureRateLimits.bulkOperation);

      const { orderIds, status } = input;

      // Validate all orders exist and can be updated
      const orders = await ctx.prisma.order.findMany({
        where: {
          id: { in: orderIds },
        },
        include: {
          items: {
            include: {
              productOption: true,
            },
          },
        },
      });

      if (orders.length !== orderIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Some orders not found",
        });
      }

      // Validate status transitions
      for (const order of orders) {
        if (status === OrderStatus.FINALIZED && order.status !== OrderStatus.IN_SEPARATION) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Order ${order.orderNumber} must be in separation before finalizing`,
          });
        }
      }

      // If finalizing orders, handle stock deduction
      if (status === OrderStatus.FINALIZED) {
        for (const order of orders) {
          if (order.status !== OrderStatus.FINALIZED) {
            await validateStockAvailability(ctx.prisma, order.id);
            await deductStockForOrder(ctx.prisma, order.id, ctx.userId);
          }
        }
      }

      // Update all orders
      const result = await ctx.prisma.order.updateMany({
        where: {
          id: { in: orderIds },
        },
        data: {
          status,
          ...(status === OrderStatus.FINALIZED && { finalizedAt: new Date() }),
        },
      });

      return {
        success: true,
        updated: result.count,
      };
    }),

  /**
   * Export orders to CSV format - tenant admin only
   */
  exportCsv: tenantAdminProcedure
    .input(
      z.object({
        orderIds: z.array(z.string().uuid()).optional(),
        status: z.nativeEnum(OrderStatus).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Rate limit export operations
      checkRateLimit(`export:csv:${ctx.userId}`, procedureRateLimits.export);

      // Security: Always filter by tenant to prevent cross-tenant data exposure
      const where: Prisma.OrderWhereInput = {
        account: {
          tenantId: ctx.tenantId,
        },
        // Don't export draft orders by default
        status: { not: OrderStatus.DRAFT },
      };

      if (input.orderIds && input.orderIds.length > 0) {
        where.id = { in: input.orderIds };
      }

      if (input.status) {
        where.status = input.status;
      }

      // Date range filter
      if (input.startDate || input.endDate) {
        where.createdAt = {};
        if (input.startDate) {
          where.createdAt.gte = new Date(input.startDate);
        }
        if (input.endDate) {
          where.createdAt.lte = new Date(input.endDate);
        }
      }

      const orders = await ctx.prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              productOption: {
                include: {
                  product: true,
                },
              },
            },
          },
          customer: {
            include: {
              account: true,
            },
          },
          createdByUser: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Generate CSV content
      const csvContent = generateOrdersCsv(orders);
      const filename = generateCsvFilename("pedidos");

      return {
        csv: csvContent,
        filename,
        count: orders.length,
      };
    }),

  /**
   * Create a draft order from an existing order (reorder functionality)
   */
  reorder: accountProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Get the original order with items
      const originalOrder = await ctx.prisma.order.findUnique({
        where: { id: input.orderId },
        include: {
          items: {
            include: {
              productOption: true,
            },
          },
        },
      });

      if (!originalOrder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      // Verify user has access to this order's account
      if (originalOrder.accountId !== ctx.accountId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to reorder this order",
        });
      }

      // Check if user already has a draft order
      const existingDraft = await ctx.prisma.order.findFirst({
        where: {
          accountId: ctx.accountId,
          createdBy: ctx.userId,
          status: OrderStatus.DRAFT,
        },
      });

      // If existing draft exists, delete it and create new one
      if (existingDraft) {
        await ctx.prisma.order.delete({
          where: { id: existingDraft.id },
        });
      }

      // Create new draft order with items from original order
      const draftOrder = await ctx.prisma.order.create({
        data: {
          customerId: originalOrder.customerId,
          accountId: originalOrder.accountId,
          createdBy: ctx.userId,
          status: OrderStatus.DRAFT,
          orderNumber: "DRAFT",
          items: {
            create: originalOrder.items.map((item) => ({
              productOptionId: item.productOptionId,
              requestedQty: item.requestedQty,
              notes: item.notes,
              // For FIXED items, set finalPrice using current prices
              finalPrice: item.productOption.unitType === "FIXED" ? null : null,
              isExtra: false,
            })),
          },
        },
        include: {
          items: {
            include: {
              productOption: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });

      // Resolve prices for FIXED items using current pricing
      for (const item of draftOrder.items) {
        if (item.productOption.unitType === "FIXED") {
          const finalPrice = await calculateFixedItemPrice(
            item.productOptionId,
            item.requestedQty,
            originalOrder.customerId
          );
          await ctx.prisma.orderItem.update({
            where: { id: item.id },
            data: { finalPrice },
          });
        }
      }

      return draftOrder;
    }),

  /**
   * Get activity log for an order
   */
  getActivities: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const activityService = new ActivityService(ctx.prisma);

      // Verify user has access to this order
      const order = await ctx.prisma.order.findUnique({
        where: { id: input.orderId },
        select: {
          id: true,
          accountId: true,
          customer: {
            select: {
              account: {
                select: {
                  tenantId: true,
                },
              },
            },
          },
        },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      // Check if user has access (either through tenant or account)
      const userMemberships = await ctx.prisma.membership.findMany({
        where: { userId: ctx.userId },
        include: {
          role: true,
          tenant: true,
          account: true,
        },
      });

      const hasAccess = userMemberships.some((membership) => {
        // Platform admin has access to everything
        if (membership.role.name === "PLATFORM_ADMIN") return true;

        // Tenant admin has access to all orders in their tenant
        if (
          membership.tenantId === order.customer.account.tenantId &&
          ["TENANT_OWNER", "TENANT_ADMIN"].includes(membership.role.name)
        ) {
          return true;
        }

        // Account users have access to their account's orders
        if (
          membership.accountId === order.accountId &&
          ["ACCOUNT_OWNER", "ACCOUNT_BUYER"].includes(membership.role.name)
        ) {
          return true;
        }

        return false;
      });

      if (!hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to view this order's activities",
        });
      }

      // Fetch and return activities
      return activityService.getOrderActivities(input.orderId);
    }),
});
