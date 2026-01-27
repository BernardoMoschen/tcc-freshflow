import { z } from "zod";
import { router, protectedProcedure, tenantProcedure } from "../trpc.js";

export const productsRouter = router({
  /**
   * List products with pagination, search, and category filter
   */
  list: tenantProcedure
    .input(
      z.object({
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        category: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { skip, take, search, category } = input;

      const where = {
        tenantId: ctx.tenantId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        }),
        ...(category && { category }),
      };

      const [items, total] = await Promise.all([
        ctx.prisma.product.findMany({
          where,
          skip,
          take,
          include: {
            options: true,
          },
          orderBy: {
            name: "asc",
          },
        }),
        ctx.prisma.product.count({ where }),
      ]);

      return {
        items,
        total,
      };
    }),

  /**
   * Get single product with options and customer prices
   */
  get: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        customerId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const product = await ctx.prisma.product.findUnique({
        where: { id: input.id },
        include: {
          options: {
            include: {
              customerPrices: input.customerId
                ? {
                    where: {
                      customerId: input.customerId,
                    },
                  }
                : false,
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      if (!product) {
        throw new Error("Product not found");
      }

      // Format options with resolved prices
      const optionsWithPrices = product.options.map((option) => {
        const customerPrice =
          option.customerPrices && option.customerPrices.length > 0
            ? option.customerPrices[0].price
            : null;

        return {
          ...option,
          resolvedPrice: customerPrice || option.basePrice,
          hasCustomerPrice: !!customerPrice,
        };
      });

      return {
        ...product,
        options: optionsWithPrices,
      };
    }),
});
