import { z } from "zod";
import { router, protectedProcedure, tenantProcedure } from "../trpc.js";
import { StockMovementType } from "@prisma/client";
import { Errors } from "../lib/errors.js";

export const stockRouter = router({
  /**
   * Add stock to a product option (receive inventory)
   */
  addStock: protectedProcedure
    .input(
      z.object({
        productOptionId: z.string().uuid(),
        quantity: z.number().positive(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify product option exists
      const productOption = await ctx.prisma.productOption.findUnique({
        where: { id: input.productOptionId },
        include: { product: true },
      });

      if (!productOption) {
        throw Errors.notFound("Product option", input.productOptionId);
      }

      // Use transaction to ensure atomicity
      const result = await ctx.prisma.$transaction(async (tx) => {
        // Update stock quantity
        const updatedOption = await tx.productOption.update({
          where: { id: input.productOptionId },
          data: {
            stockQuantity: {
              increment: input.quantity,
            },
          },
        });

        // Create stock movement record
        const movement = await tx.stockMovement.create({
          data: {
            productOptionId: input.productOptionId,
            type: StockMovementType.MANUAL_ADDITION,
            quantity: input.quantity,
            notes: input.notes || `Added ${input.quantity} units`,
            userId: ctx.userId,
          },
        });

        return { updatedOption, movement };
      });

      return result;
    }),

  /**
   * Remove stock from a product option (manual deduction)
   */
  removeStock: protectedProcedure
    .input(
      z.object({
        productOptionId: z.string().uuid(),
        quantity: z.number().positive(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify product option exists
      const productOption = await ctx.prisma.productOption.findUnique({
        where: { id: input.productOptionId },
      });

      if (!productOption) {
        throw Errors.notFound("Product option", input.productOptionId);
      }

      // Check if sufficient stock
      const currentStock = productOption.stockQuantity ?? 0;
      if (currentStock < input.quantity) {
        throw Errors.badRequest(
          `Insufficient stock. Available: ${currentStock}, Requested: ${input.quantity}`
        );
      }

      // Use transaction to ensure atomicity
      const result = await ctx.prisma.$transaction(async (tx) => {
        // Update stock quantity
        const updatedOption = await tx.productOption.update({
          where: { id: input.productOptionId },
          data: {
            stockQuantity: {
              decrement: input.quantity,
            },
          },
        });

        // Create stock movement record
        const movement = await tx.stockMovement.create({
          data: {
            productOptionId: input.productOptionId,
            type: StockMovementType.MANUAL_DEDUCTION,
            quantity: -input.quantity, // negative for deduction
            notes: input.notes || `Removed ${input.quantity} units`,
            userId: ctx.userId,
          },
        });

        return { updatedOption, movement };
      });

      return result;
    }),

  /**
   * Adjust stock (inventory reconciliation)
   */
  adjustStock: protectedProcedure
    .input(
      z.object({
        productOptionId: z.string().uuid(),
        newQuantity: z.number().min(0),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify product option exists
      const productOption = await ctx.prisma.productOption.findUnique({
        where: { id: input.productOptionId },
      });

      if (!productOption) {
        throw Errors.notFound("Product option", input.productOptionId);
      }

      const oldQuantity = productOption.stockQuantity ?? 0;
      const difference = input.newQuantity - oldQuantity;

      // Use transaction to ensure atomicity
      const result = await ctx.prisma.$transaction(async (tx) => {
        // Update stock quantity to exact value
        const updatedOption = await tx.productOption.update({
          where: { id: input.productOptionId },
          data: {
            stockQuantity: input.newQuantity,
          },
        });

        // Create stock movement record
        const movement = await tx.stockMovement.create({
          data: {
            productOptionId: input.productOptionId,
            type: StockMovementType.ADJUSTMENT,
            quantity: difference,
            notes:
              input.notes ||
              `Adjusted from ${oldQuantity} to ${input.newQuantity} (${difference > 0 ? "+" : ""}${difference})`,
            userId: ctx.userId,
          },
        });

        return { updatedOption, movement };
      });

      return result;
    }),

  /**
   * Get stock movements history for a product option
   */
  getMovements: protectedProcedure
    .input(
      z.object({
        productOptionId: z.string().uuid().optional(),
        type: z.nativeEnum(StockMovementType).optional(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};

      if (input.productOptionId) {
        where.productOptionId = input.productOptionId;
      }

      if (input.type) {
        where.type = input.type;
      }

      const [items, total] = await Promise.all([
        ctx.prisma.stockMovement.findMany({
          where,
          skip: input.skip,
          take: input.take,
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
        }),
        ctx.prisma.stockMovement.count({ where }),
      ]);

      return {
        items,
        total,
      };
    }),

  /**
   * Get current stock levels across all products (with low stock alerts)
   */
  getStockLevels: tenantProcedure
    .input(
      z.object({
        category: z.string().optional(),
        lowStockOnly: z.boolean().default(false),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {
        tenantId: ctx.tenantId,
      };

      if (input.category) {
        where.category = input.category;
      }

      // Fetch products with their options
      const products = await ctx.prisma.product.findMany({
        where,
        skip: input.skip,
        take: input.take,
        include: {
          options: {
            orderBy: {
              name: "asc",
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      });

      // Filter and format stock data
      const stockLevels = products.flatMap((product) =>
        product.options
          .filter((option) => {
            if (!input.lowStockOnly) return true;

            const stock = option.stockQuantity ?? 0;
            const threshold = option.lowStockThreshold ?? 10;
            return stock <= threshold;
          })
          .map((option) => {
            const stock = option.stockQuantity ?? 0;
            const threshold = option.lowStockThreshold ?? 10;

            return {
              productId: product.id,
              productName: product.name,
              productCategory: product.category,
              optionId: option.id,
              optionName: option.name,
              sku: option.sku,
              unitType: option.unitType,
              stockQuantity: stock,
              lowStockThreshold: threshold,
              isLowStock: stock <= threshold && stock > 0,
              isOutOfStock: stock === 0 || !option.isAvailable,
              isAvailable: option.isAvailable,
            };
          })
      );

      const total = await ctx.prisma.product.count({ where });

      return {
        items: stockLevels,
        total,
      };
    }),

  /**
   * Toggle product availability
   */
  toggleAvailability: protectedProcedure
    .input(
      z.object({
        productOptionId: z.string().uuid(),
        isAvailable: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updatedOption = await ctx.prisma.productOption.update({
        where: { id: input.productOptionId },
        data: {
          isAvailable: input.isAvailable,
        },
      });

      return updatedOption;
    }),
});
