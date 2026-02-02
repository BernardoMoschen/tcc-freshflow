import { z } from "zod";
import { Prisma, PrismaClient } from "@prisma/client";
import { router, tenantProcedure, tenantAdminProcedure, publicProcedure } from "../trpc.js";
import { resolvePricesBatch } from "../lib/price-engine.js";
import { Errors } from "../lib/errors.js";

/**
 * Verify that a product belongs to the specified tenant.
 * Throws NotFound error if product doesn't exist or doesn't belong to tenant.
 */
async function verifyProductTenantAccess(
  prisma: PrismaClient,
  productId: string,
  tenantId: string
): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { tenantId: true },
  });

  if (!product || product.tenantId !== tenantId) {
    throw Errors.notFound("Product", productId);
  }
}

/**
 * Verify that a product option belongs to a product in the specified tenant.
 * Throws NotFound error if option doesn't exist or doesn't belong to tenant.
 */
async function verifyProductOptionTenantAccess(
  prisma: PrismaClient,
  optionId: string,
  tenantId: string
): Promise<void> {
  const option = await prisma.productOption.findUnique({
    where: { id: optionId },
    include: { product: { select: { tenantId: true } } },
  });

  if (!option || option.product.tenantId !== tenantId) {
    throw Errors.notFound("ProductOption", optionId);
  }
}

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

      const isPriceSorting = sortBy === "price";

      // Get total count first (shared across both paths)
      const total = await ctx.prisma.product.count({ where });

      // Type for product with options and customer prices
      type ProductWithOptions = Prisma.ProductGetPayload<{
        include: {
          options: {
            include: {
              customerPrices: true;
            };
          };
        };
      }>;

      let items: ProductWithOptions[];

      if (isPriceSorting && total > 0) {
        // Price sorting: Use two-phase approach for better efficiency
        // Phase 1: Get only IDs and min prices (lightweight query)
        const productsWithMinPrice = await ctx.prisma.product.findMany({
          where,
          select: {
            id: true,
            options: {
              select: {
                basePrice: true,
                customerPrices: customerId
                  ? {
                      where: { customerId },
                      select: { price: true },
                    }
                  : false,
              },
            },
          },
        });

        // Calculate min price for each product
        const sortedIds = productsWithMinPrice
          .map((product) => {
            const prices = product.options.map((opt) => {
              // Use customer price if available, otherwise base price
              const customerPrice = opt.customerPrices && opt.customerPrices[0]?.price;
              return customerPrice ?? opt.basePrice;
            });
            const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
            return { id: product.id, minPrice };
          })
          .sort((a, b) => sortOrder === "asc" ? a.minPrice - b.minPrice : b.minPrice - a.minPrice)
          .slice(skip, skip + take)
          .map((p) => p.id);

        // Phase 2: Fetch full details for only the paginated products
        if (sortedIds.length > 0) {
          const fullProducts = await ctx.prisma.product.findMany({
            where: { id: { in: sortedIds } },
            include: {
              options: {
                include: {
                  customerPrices: customerId
                    ? { where: { customerId } }
                    : false,
                },
              },
            },
          });

          // Maintain sort order (Prisma doesn't preserve order from `in` clause)
          const productMap = new Map(fullProducts.map((p) => [p.id, p]));
          items = sortedIds.map((id) => productMap.get(id)!).filter(Boolean);
        } else {
          items = [];
        }
      } else {
        // Name sorting: Direct database sort with pagination
        items = await ctx.prisma.product.findMany({
          where,
          skip,
          take,
          include: {
            options: {
              include: {
                customerPrices: customerId
                  ? { where: { customerId } }
                  : false,
              },
            },
          },
          orderBy,
        });
      }

      // Resolve customer prices using centralized price engine
      const processedItems = items.map((product) => ({
        ...product,
        options: resolvePricesBatch(product.options),
      }));

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
        throw Errors.notFound("Product", input.id);
      }

      // Security: Verify product belongs to the requesting tenant
      if (product.tenant.id !== ctx.tenantId) {
        throw Errors.notFound("Product", input.id);
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

      await verifyProductTenantAccess(ctx.prisma, id, ctx.tenantId);

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
      await verifyProductTenantAccess(ctx.prisma, input.id, ctx.tenantId);

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
      await verifyProductTenantAccess(ctx.prisma, input.productId, ctx.tenantId);

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

      await verifyProductOptionTenantAccess(ctx.prisma, id, ctx.tenantId);

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
      await verifyProductOptionTenantAccess(ctx.prisma, input.id, ctx.tenantId);

      await ctx.prisma.productOption.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * Public catalog - Get products by tenant slug (no auth required)
   * Perfect for sharing via WhatsApp
   */
  publicCatalog: publicProcedure
    .input(
      z.object({
        tenantSlug: z.string(),
        category: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Find tenant by slug
      const tenant = await ctx.prisma.tenant.findUnique({
        where: { slug: input.tenantSlug },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      });

      if (!tenant) {
        throw Errors.notFound("Tenant", input.tenantSlug);
      }

      // Build where clause
      const where: Prisma.ProductWhereInput = {
        tenantId: tenant.id,
        ...(input.search && {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { description: { contains: input.search, mode: "insensitive" as const } },
          ],
        }),
        ...(input.category && { category: input.category }),
      };

      // Get products with available options only
      const products = await ctx.prisma.product.findMany({
        where,
        include: {
          options: {
            where: {
              isAvailable: true,
              stockQuantity: { gt: 0 }, // Only show in-stock items
            },
            orderBy: { basePrice: "asc" },
          },
        },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      });

      // Filter out products with no available options
      const availableProducts = products.filter((p) => p.options.length > 0);

      // Get unique categories
      const categories = [
        ...new Set(availableProducts.map((p) => p.category).filter((c): c is string => !!c)),
      ];

      return {
        tenant,
        products: availableProducts,
        categories,
      };
    }),
});
