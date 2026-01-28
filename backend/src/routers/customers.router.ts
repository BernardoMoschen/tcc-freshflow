import { z } from "zod";
import { Prisma } from "@prisma/client";
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
      const where: Prisma.CustomerWhereInput = {
        account: {
          tenantId: ctx.tenantId,
        },
      };

      if (input.search) {
        where.account = {
          tenantId: ctx.tenantId,
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

      // Security: Verify customer belongs to the requesting tenant
      if (customer.account.tenantId !== ctx.tenantId) {
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
      // Verify customer and product option exist with tenant info
      const [customer, productOption] = await Promise.all([
        ctx.prisma.customer.findUnique({
          where: { id: input.customerId },
          include: { account: { select: { tenantId: true } } },
        }),
        ctx.prisma.productOption.findUnique({
          where: { id: input.productOptionId },
          include: { product: { select: { tenantId: true } } },
        }),
      ]);

      if (!customer) {
        throw Errors.notFound("Customer", input.customerId);
      }

      // Security: Verify customer belongs to the requesting tenant
      if (customer.account.tenantId !== ctx.tenantId) {
        throw Errors.notFound("Customer", input.customerId);
      }

      if (!productOption) {
        throw Errors.notFound("Product option", input.productOptionId);
      }

      // Security: Verify product belongs to the requesting tenant
      if (productOption.product.tenantId !== ctx.tenantId) {
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
      // Security: Verify customer belongs to the requesting tenant
      const customer = await ctx.prisma.customer.findUnique({
        where: { id: input.customerId },
        include: { account: { select: { tenantId: true } } },
      });

      if (!customer) {
        throw Errors.notFound("Customer", input.customerId);
      }

      if (customer.account.tenantId !== ctx.tenantId) {
        throw Errors.notFound("Customer", input.customerId);
      }

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
   * Performance: Uses database aggregation instead of fetching all orders
   */
  getStats: tenantAdminProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Security: Verify customer belongs to the requesting tenant
      const customer = await ctx.prisma.customer.findUnique({
        where: { id: input.customerId },
        include: { account: { select: { tenantId: true } } },
      });

      if (!customer) {
        throw Errors.notFound("Customer", input.customerId);
      }

      if (customer.account.tenantId !== ctx.tenantId) {
        throw Errors.notFound("Customer", input.customerId);
      }

      // Use parallel queries with database aggregation for better performance
      const [totalOrders, lastOrder, revenueResult] = await Promise.all([
        // Count orders
        ctx.prisma.order.count({
          where: { customerId: input.customerId },
        }),
        // Get only the most recent order
        ctx.prisma.order.findFirst({
          where: { customerId: input.customerId },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        // Calculate total revenue using raw SQL for efficiency
        // This calculates: SUM(finalPrice * COALESCE(actualWeight, requestedQty))
        ctx.prisma.$queryRaw<Array<{ total: number | null }>>`
          SELECT COALESCE(SUM(
            oi."finalPrice" * COALESCE(oi."actualWeight", oi."requestedQty")
          ), 0) as total
          FROM "OrderItem" oi
          INNER JOIN "Order" o ON o.id = oi."orderId"
          WHERE o."customerId" = ${input.customerId}::uuid
            AND oi."finalPrice" IS NOT NULL
        `,
      ]);

      const totalRevenue = revenueResult[0]?.total ?? 0;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      return {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        lastOrderDate: lastOrder?.createdAt ?? null,
      };
    }),
});
