import { z } from "zod";
import { router, tenantAdminProcedure } from "../trpc.js";
import { Errors } from "../lib/errors.js";

export const customersRouter = router({
  /**
   * List all customers with their accounts (tenant admin only)
   */
  list: tenantAdminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {
        account: {
          tenantId: ctx.tenantId,
        },
      };

      if (input.search) {
        where.account = {
          ...where.account,
          name: {
            contains: input.search,
            mode: "insensitive" as const,
          },
        };
      }

      const [items, total] = await Promise.all([
        ctx.prisma.customer.findMany({
          where,
          skip: input.skip,
          take: input.take,
          include: {
            account: true,
            customerPrices: {
              include: {
                productOption: {
                  include: {
                    product: true,
                  },
                },
              },
            },
            orders: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                createdAt: true,
              },
              orderBy: {
                createdAt: "desc",
              },
              take: 5,
            },
          },
          orderBy: {
            account: {
              name: "asc",
            },
          },
        }),
        ctx.prisma.customer.count({ where }),
      ]);

      return { items, total };
    }),

  /**
   * Get single customer with full details (tenant admin only)
   */
  get: tenantAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const customer = await ctx.prisma.customer.findUnique({
        where: { id: input.id },
        include: {
          account: {
            include: {
              memberships: {
                include: {
                  user: true,
                  role: true,
                },
              },
            },
          },
          customerPrices: {
            include: {
              productOption: {
                include: {
                  product: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
          orders: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              createdAt: true,
              sentAt: true,
              finalizedAt: true,
              items: {
                select: {
                  id: true,
                  finalPrice: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 20,
          },
        },
      });

      if (!customer) {
        throw Errors.notFound("Customer", input.id);
      }

      return customer;
    }),

  /**
   * Set custom price for a product option for a customer (tenant admin only)
   */
  setCustomPrice: tenantAdminProcedure
    .input(
      z.object({
        customerId: z.string().uuid(),
        productOptionId: z.string().uuid(),
        price: z.number().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify customer and product option exist
      const [customer, productOption] = await Promise.all([
        ctx.prisma.customer.findUnique({
          where: { id: input.customerId },
        }),
        ctx.prisma.productOption.findUnique({
          where: { id: input.productOptionId },
        }),
      ]);

      if (!customer) {
        throw Errors.notFound("Customer", input.customerId);
      }

      if (!productOption) {
        throw Errors.notFound("Product option", input.productOptionId);
      }

      // Upsert customer price
      const customerPrice = await ctx.prisma.customerPrice.upsert({
        where: {
          customerId_productOptionId: {
            customerId: input.customerId,
            productOptionId: input.productOptionId,
          },
        },
        create: {
          customerId: input.customerId,
          productOptionId: input.productOptionId,
          price: input.price,
        },
        update: {
          price: input.price,
        },
        include: {
          productOption: {
            include: {
              product: true,
            },
          },
        },
      });

      return customerPrice;
    }),

  /**
   * Remove custom price (revert to base price) - tenant admin only
   */
  removeCustomPrice: tenantAdminProcedure
    .input(
      z.object({
        customerId: z.string().uuid(),
        productOptionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.customerPrice.delete({
        where: {
          customerId_productOptionId: {
            customerId: input.customerId,
            productOptionId: input.productOptionId,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Get customer statistics (tenant admin only)
   */
  getStats: tenantAdminProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [totalOrders, orders] = await Promise.all([
        ctx.prisma.order.count({
          where: { customerId: input.customerId },
        }),
        ctx.prisma.order.findMany({
          where: { customerId: input.customerId },
          include: {
            items: {
              select: {
                finalPrice: true,
                requestedQty: true,
                actualWeight: true,
                productOption: {
                  select: {
                    unitType: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      // Calculate total revenue
      let totalRevenue = 0;
      orders.forEach((order) => {
        order.items.forEach((item) => {
          if (item.finalPrice) {
            if (item.productOption.unitType === "WEIGHT" && item.actualWeight) {
              totalRevenue += item.finalPrice * item.actualWeight;
            } else {
              totalRevenue += item.finalPrice * item.requestedQty;
            }
          }
        });
      });

      // Find last order date
      const lastOrder = orders.length > 0 ? orders[0].createdAt : null;

      // Calculate average order value
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      return {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        lastOrderDate: lastOrder,
      };
    }),
});
