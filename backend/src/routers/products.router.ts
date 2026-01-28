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
        customerId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { skip, take, search, category, minPrice, maxPrice, unitType, sortBy, sortOrder, customerId } = input;

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
            options: {
              include: {
                customerPrices: customerId
                  ? {
                      where: {
                        customerId,
                      },
                    }
                  : false,
              },
            },
          },
          orderBy,
        }),
        ctx.prisma.product.count({ where }),
      ]);

      // Resolve customer prices
      const itemsWithResolvedPrices = items.map((product) => ({
        ...product,
        options: product.options.map((option: any) => {
          const customerPrice =
            option.customerPrices && option.customerPrices.length > 0
              ? option.customerPrices[0].price
              : null;

          return {
            ...option,
            resolvedPrice: customerPrice || option.basePrice,
            hasCustomerPrice: !!customerPrice,
          };
        }),
      }));

      // Post-process for price sorting
      let processedItems = itemsWithResolvedPrices;
      if (sortBy === "price") {
        // Calculate min price for each product
        const itemsWithMinPrice = itemsWithResolvedPrices.map((product) => {
          const minPrice = Math.min(...product.options.map((opt) => opt.resolvedPrice));
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

  /**
   * Create a new product with options
   */
  create: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        category: z.string().optional(),
        imageUrl: z.string().url().optional(),
        options: z.array(
          z.object({
            name: z.string().min(1),
            sku: z.string().min(1),
            unitType: z.enum(["FIXED", "WEIGHT"]),
            basePrice: z.number().positive(),
            stockQuantity: z.number().min(0).default(0),
            lowStockThreshold: z.number().min(0).default(10),
            isAvailable: z.boolean().default(true),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.prisma.product.create({
        data: {
          name: input.name,
          description: input.description,
          category: input.category,
          imageUrl: input.imageUrl,
          tenantId: ctx.tenantId,
          options: {
            create: input.options,
          },
        },
        include: {
          options: true,
        },
      });

      return product;
    }),

  /**
   * Update an existing product
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        imageUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const product = await ctx.prisma.product.update({
        where: { id },
        data,
        include: {
          options: true,
        },
      });

      return product;
    }),

  /**
   * Delete a product (and all its options)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.product.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * Create a product option
   */
  createOption: protectedProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        name: z.string().min(1),
        sku: z.string().min(1),
        unitType: z.enum(["FIXED", "WEIGHT"]),
        basePrice: z.number().positive(),
        stockQuantity: z.number().min(0).default(0),
        lowStockThreshold: z.number().min(0).default(10),
        isAvailable: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const option = await ctx.prisma.productOption.create({
        data: input,
      });

      return option;
    }),

  /**
   * Update a product option
   */
  updateOption: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        sku: z.string().min(1).optional(),
        unitType: z.enum(["FIXED", "WEIGHT"]).optional(),
        basePrice: z.number().positive().optional(),
        stockQuantity: z.number().min(0).optional(),
        lowStockThreshold: z.number().min(0).optional(),
        isAvailable: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const option = await ctx.prisma.productOption.update({
        where: { id },
        data,
      });

      return option;
    }),

  /**
   * Delete a product option
   */
  deleteOption: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.productOption.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
