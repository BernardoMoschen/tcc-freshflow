import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, accountProcedure } from "../trpc.js";
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
} from "../lib/whatsapp.js";
import {
  validateStockAvailability,
  deductStockForOrder,
} from "../lib/stock-manager.js";

export const ordersRouter = router({
  /**
   * Create new order (status: SENT, immutable)
   */
  create: accountProcedure
    .input(
      z.object({
        notes: z.string().optional(),
        items: z.array(
          z.object({
            productOptionId: z.string().uuid(),
            requestedQty: z.number().positive(),
            isExtra: z.boolean().default(false),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

      // Validate all product options exist and get their unit types
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

      // Create order items with resolved prices
      const orderItems = await Promise.all(
        input.items.map(async (item) => {
          const productOption = productOptions.find(
            (po) => po.id === item.productOptionId
          );

          if (!productOption) {
            throw new Error("Product option not found");
          }

          // For FIXED items, calculate finalPrice now
          // For WEIGHT items, finalPrice will be set during weighing
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
            isExtra: item.isExtra,
          };
        })
      );

      // Create order
      const order = await ctx.prisma.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerId: customer.id,
          accountId: ctx.accountId,
          createdBy: ctx.userId,
          status: OrderStatus.SENT,
          sentAt: new Date(),
          notes: input.notes,
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
          createdByUser: true,
        },
      });

      // Send WhatsApp notification (if configured)
      const phoneNumber = process.env.WHATSAPP_DEFAULT_PHONE;
      if (phoneNumber) {
        try {
          await sendOrderCreatedNotification(
            phoneNumber,
            order,
            order.customer.account.name
          );
        } catch (error) {
          console.error("Failed to send WhatsApp notification:", error);
          // Don't fail the order creation if notification fails
        }
      }

      return order;
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
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
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

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      return order;
    }),

  /**
   * Weigh order item (creates Weighing record, updates OrderItem)
   */
  weigh: protectedProcedure
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
   * Add extra item to order (admin only, before finalization)
   */
  addItem: protectedProcedure
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
   * Finalize order (validates all WEIGHT items weighed, updates status)
   */
  finalize: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
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
          console.error("Failed to send WhatsApp notification:", error);
          // Don't fail the finalization if notification fails
        }
      }

      return finalizedOrder;
    }),
});
