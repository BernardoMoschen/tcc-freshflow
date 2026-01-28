import { z } from "zod";
import { router, protectedProcedure, tenantProcedure } from "../trpc.js";

export const productsRouter = router({
  /**
   * List products with pagination, search, filters, and sorting
   */
  list: tenantProcedure
    .input(
      z.object({
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        category: z.string().optional(),
        minPrice: z.number().min(0).optional(),
        maxPrice: z.number().min(0).optional(),
        unitType: z.enum(["FIXED", "WEIGHT"]).optional(),
        sortBy: z.enum(["name", "price"]).default("name"),
        sortOrder: z.enum(["asc", "desc"]).default("asc"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { skip, take, search, category, minPrice, maxPrice, unitType, sortBy, sortOrder } = input;

      // Build base where clause for products
      const where: any = {
        tenantId: ctx.tenantId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        }),
        ...(category && { category }),
      };

      // Add filters for product options (price range, unit type)
      const optionsFilter: any = {};
      if (minPrice !== undefined || maxPrice !== undefined || unitType !== undefined) {
        if (minPrice !== undefined || maxPrice !== undefined) {
          optionsFilter.basePrice = {};
          if (minPrice !== undefined) optionsFilter.basePrice.gte = minPrice;
          if (maxPrice !== undefined) optionsFilter.basePrice.lte = maxPrice;
        }
        if (unitType !== undefined) {
          optionsFilter.unitType = unitType;
        }
        where.options = { some: optionsFilter };
      }

      // Build orderBy clause
      let orderBy: any;
      if (sortBy === "price") {
        // Sort by minimum option price
        // Note: Prisma doesn't support direct sorting by aggregated fields,
        // so we'll fetch all matching products and sort in memory for price
        orderBy = { name: sortOrder };
      } else {
        orderBy = { name: sortOrder };
      }

      const [items, total] = await Promise.all([
        ctx.prisma.product.findMany({
          where,
          skip: sortBy === "price" ? 0 : skip,
          take: sortBy === "price" ? undefined : take,
          include: {
            options: true,
          },
          orderBy,
        }),
        ctx.prisma.product.count({ where }),
      ]);

      // Post-process for price sorting
      let processedItems = items;
      if (sortBy === "price") {
        // Calculate min price for each product
        const itemsWithMinPrice = items.map((product) => {
          const minPrice = Math.min(...product.options.map((opt) => opt.basePrice));
          return { ...product, minPrice };
        });

        // Sort by min price
        itemsWithMinPrice.sort((a, b) => {
          return sortOrder === "asc" ? a.minPrice - b.minPrice : b.minPrice - a.minPrice;
        });

        // Apply pagination after sorting
        processedItems = itemsWithMinPrice.slice(skip, skip + take);
      }

      return {
        items: processedItems,
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
