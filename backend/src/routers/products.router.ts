import { z } from "zod";
import { Prisma } from "@prisma/client";
import { router, tenantProcedure, tenantAdminProcedure } from "../trpc.js";
import { resolvePricesBatch } from "../lib/price-engine.js";

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
      const where: Prisma.ProductWhereInput = {
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
      const optionsFilter: Prisma.ProductOptionWhereInput = {};
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
      const orderBy: { name: "asc" | "desc" } = { name: sortOrder };

      // Performance: When sorting by price, we need to fetch products and sort in memory
      // because Prisma doesn't support sorting by aggregated related fields.
      // To prevent unbounded queries, we limit to 500 products max for price sorting.
      const PRICE_SORT_MAX_PRODUCTS = 500;
      const isPriceSorting = sortBy === "price";

      const [items, total] = await Promise.all([
        ctx.prisma.product.findMany({
          where,
          skip: isPriceSorting ? 0 : skip,
          take: isPriceSorting ? PRICE_SORT_MAX_PRODUCTS : take,
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

      // Resolve customer prices using centralized price engine
      const itemsWithResolvedPrices = items.map((product) => ({
        ...product,
        options: resolvePricesBatch(product.options),
      }));

      // Post-process for price sorting
      let processedItems = itemsWithResolvedPrices;
      if (isPriceSorting) {
        // Calculate min price for each product
        const itemsWithMinPrice = itemsWithResolvedPrices.map((product) => {
          const prices = product.options.map((opt) => opt.resolvedPrice);
          const minOptionPrice = prices.length > 0 ? Math.min(...prices) : 0;
          return { ...product, minPrice: minOptionPrice };
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
  get: tenantProcedure
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

      // Security: Verify product belongs to the requesting tenant
      if (product.tenant.id !== ctx.tenantId) {
        throw new Error("Product not found");
      }

      // Format options with resolved prices using centralized price engine
      return {
        ...product,
        options: resolvePricesBatch(product.options),
      };
    }),

  /**
   * Create a new product with options (tenant admin only)
   */
  create: tenantAdminProcedure
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
   * Update an existing product (tenant admin only)
   */
  update: tenantAdminProcedure
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

      // Verify product belongs to this tenant
      const existingProduct = await ctx.prisma.product.findUnique({
        where: { id },
        select: { tenantId: true },
      });

      if (!existingProduct || existingProduct.tenantId !== ctx.tenantId) {
        throw new Error("Product not found or access denied");
      }

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
   * Delete a product (and all its options) - tenant admin only
   */
  delete: tenantAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify product belongs to this tenant
      const existingProduct = await ctx.prisma.product.findUnique({
        where: { id: input.id },
        select: { tenantId: true },
      });

      if (!existingProduct || existingProduct.tenantId !== ctx.tenantId) {
        throw new Error("Product not found or access denied");
      }

      await ctx.prisma.product.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * Create a product option (tenant admin only)
   */
  createOption: tenantAdminProcedure
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
      // Verify product belongs to this tenant
      const product = await ctx.prisma.product.findUnique({
        where: { id: input.productId },
        select: { tenantId: true },
      });

      if (!product || product.tenantId !== ctx.tenantId) {
        throw new Error("Product not found or access denied");
      }

      const option = await ctx.prisma.productOption.create({
        data: input,
      });

      return option;
    }),

  /**
   * Update a product option (tenant admin only)
   */
  updateOption: tenantAdminProcedure
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

      // Verify option belongs to a product in this tenant
      const option = await ctx.prisma.productOption.findUnique({
        where: { id },
        include: { product: { select: { tenantId: true } } },
      });

      if (!option || option.product.tenantId !== ctx.tenantId) {
        throw new Error("Product option not found or access denied");
      }

      const updatedOption = await ctx.prisma.productOption.update({
        where: { id },
        data,
      });

      return updatedOption;
    }),

  /**
   * Delete a product option (tenant admin only)
   */
  deleteOption: tenantAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify option belongs to a product in this tenant
      const option = await ctx.prisma.productOption.findUnique({
        where: { id: input.id },
        include: { product: { select: { tenantId: true } } },
      });

      if (!option || option.product.tenantId !== ctx.tenantId) {
        throw new Error("Product option not found or access denied");
      }

      await ctx.prisma.productOption.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
