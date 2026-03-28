import { z } from "zod";
import { router, tenantAdminProcedure } from "../trpc.js";
import { OrderStatus, Prisma } from "@prisma/client";
import { checkRateLimit, procedureRateLimits } from "../middleware/rate-limit.js";

export const analyticsRouter = router({
  /**
   * Get dashboard analytics for tenant
   * Includes revenue, order counts, top products, top customers
   */
  dashboard: tenantAdminProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Rate limit analytics queries
      checkRateLimit(`analytics:dashboard:${ctx.userId}`, procedureRateLimits.export);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Date range filters
      const startDate = input.startDate ? new Date(input.startDate) : startOfMonth;
      const endDate = input.endDate ? new Date(input.endDate) : now;

      // Base where clause for tenant filtering
      const baseWhere: Prisma.OrderWhereInput = {
        account: {
          tenantId: ctx.tenantId,
        },
        status: {
          in: [OrderStatus.SENT, OrderStatus.IN_SEPARATION, OrderStatus.FINALIZED],
        },
      };

      // Current period
      const currentWhere: Prisma.OrderWhereInput = {
        ...baseWhere,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      };

      // Last period (for comparison)
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const lastPeriodStart = new Date(startDate);
      lastPeriodStart.setDate(lastPeriodStart.getDate() - daysDiff);
      const lastPeriodEnd = new Date(startDate);

      const lastPeriodWhere: Prisma.OrderWhereInput = {
        ...baseWhere,
        createdAt: {
          gte: lastPeriodStart,
          lte: lastPeriodEnd,
        },
      };

      // Fetch current period data
      const [currentOrders, lastPeriodOrders] = await Promise.all([
        ctx.prisma.order.findMany({
          where: currentWhere,
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
        }),
        ctx.prisma.order.findMany({
          where: lastPeriodWhere,
          select: {
            id: true,
            items: {
              select: {
                finalPrice: true,
              },
            },
          },
        }),
      ]);

      // Calculate revenue
      const currentRevenue = currentOrders.reduce((sum, order) => {
        const orderTotal = order.items.reduce((itemSum, item) => {
          return itemSum + (item.finalPrice || 0);
        }, 0);
        return sum + orderTotal;
      }, 0);

      const lastPeriodRevenue = lastPeriodOrders.reduce((sum, order) => {
        const orderTotal = order.items.reduce((itemSum, item) => {
          return itemSum + (item.finalPrice || 0);
        }, 0);
        return sum + orderTotal;
      }, 0);

      const revenueChange =
        lastPeriodRevenue > 0
          ? ((currentRevenue - lastPeriodRevenue) / lastPeriodRevenue) * 100
          : 0;

      // Calculate average order value
      const avgOrderValue =
        currentOrders.length > 0 ? currentRevenue / currentOrders.length : 0;

      const lastPeriodAvgOrderValue =
        lastPeriodOrders.length > 0
          ? lastPeriodRevenue / lastPeriodOrders.length
          : 0;

      const avgOrderValueChange =
        lastPeriodAvgOrderValue > 0
          ? ((avgOrderValue - lastPeriodAvgOrderValue) / lastPeriodAvgOrderValue) * 100
          : 0;

      // Order count change
      const orderCountChange =
        lastPeriodOrders.length > 0
          ? ((currentOrders.length - lastPeriodOrders.length) / lastPeriodOrders.length) * 100
          : 0;

      // Top products by revenue
      const productRevenue = new Map<
        string,
        {
          productId: string;
          productName: string;
          optionId: string;
          optionName: string;
          revenue: number;
          quantity: number;
        }
      >();

      currentOrders.forEach((order) => {
        order.items.forEach((item) => {
          const key = item.productOptionId;
          const existing = productRevenue.get(key);

          if (existing) {
            existing.revenue += item.finalPrice || 0;
            existing.quantity +=
              item.productOption.unitType === "WEIGHT" && item.actualWeight
                ? item.actualWeight
                : item.requestedQty;
          } else {
            productRevenue.set(key, {
              productId: item.productOption.productId,
              productName: item.productOption.product.name,
              optionId: item.productOptionId,
              optionName: item.productOption.name,
              revenue: item.finalPrice || 0,
              quantity:
                item.productOption.unitType === "WEIGHT" && item.actualWeight
                  ? item.actualWeight
                  : item.requestedQty,
            });
          }
        });
      });

      const topProducts = Array.from(productRevenue.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map((p) => ({
          ...p,
          revenuePercentage: currentRevenue > 0 ? (p.revenue / currentRevenue) * 100 : 0,
        }));

      // Top customers by revenue
      const customerRevenue = new Map<
        string,
        {
          customerId: string;
          accountId: string;
          accountName: string;
          revenue: number;
          orderCount: number;
        }
      >();

      currentOrders.forEach((order) => {
        const key = order.customerId;
        const orderTotal = order.items.reduce((sum, item) => sum + (item.finalPrice || 0), 0);
        const existing = customerRevenue.get(key);

        if (existing) {
          existing.revenue += orderTotal;
          existing.orderCount += 1;
        } else {
          customerRevenue.set(key, {
            customerId: order.customerId,
            accountId: order.accountId,
            accountName: order.customer.account.name,
            revenue: orderTotal,
            orderCount: 1,
          });
        }
      });

      const topCustomers = Array.from(customerRevenue.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map((c) => ({
          ...c,
          revenuePercentage: currentRevenue > 0 ? (c.revenue / currentRevenue) * 100 : 0,
          avgOrderValue: c.orderCount > 0 ? c.revenue / c.orderCount : 0,
        }));

      // Daily revenue trend (last 30 days)
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);

      const dailyOrders = await ctx.prisma.order.findMany({
        where: {
          ...baseWhere,
          createdAt: {
            gte: last30Days,
          },
        },
        include: {
          items: {
            select: {
              finalPrice: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      // Group by day
      const dailyRevenueMap = new Map<string, { date: string; revenue: number; orders: number }>();

      dailyOrders.forEach((order) => {
        const dateKey = order.createdAt.toISOString().split("T")[0];
        const orderRevenue = order.items.reduce((sum, item) => sum + (item.finalPrice || 0), 0);

        const existing = dailyRevenueMap.get(dateKey);
        if (existing) {
          existing.revenue += orderRevenue;
          existing.orders += 1;
        } else {
          dailyRevenueMap.set(dateKey, {
            date: dateKey,
            revenue: orderRevenue,
            orders: 1,
          });
        }
      });

      const revenueTimeSeries = Array.from(dailyRevenueMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      // Order status breakdown
      const statusBreakdown = await ctx.prisma.order.groupBy({
        by: ["status"],
        where: {
          account: {
            tenantId: ctx.tenantId,
          },
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          status: true,
        },
      });

      return {
        overview: {
          revenue: {
            current: currentRevenue,
            previous: lastPeriodRevenue,
            change: revenueChange,
          },
          orders: {
            current: currentOrders.length,
            previous: lastPeriodOrders.length,
            change: orderCountChange,
          },
          avgOrderValue: {
            current: avgOrderValue,
            previous: lastPeriodAvgOrderValue,
            change: avgOrderValueChange,
          },
        },
        topProducts,
        topCustomers,
        revenueTimeSeries,
        statusBreakdown: statusBreakdown.map((s) => ({
          status: s.status,
          count: s._count.status,
        })),
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      };
    }),
});
