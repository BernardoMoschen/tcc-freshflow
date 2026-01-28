import { z } from "zod";
import { router, protectedProcedure, tenantProcedure, tenantAdminProcedure } from "../trpc.js";
import { StockMovementType } from "@prisma/client";
import { stockService } from "../services/stock.service.js";
import { auditLogger, AuditEventType } from "../lib/audit-logger.js";
import { checkRateLimit, procedureRateLimits } from "../middleware/rate-limit.js";

export const stockRouter = router({
  /**
   * Add stock to a product option (receive inventory) - tenant admin only
   */
  addStock: tenantAdminProcedure
    .input(
      z.object({
        productOptionId: z.string().uuid(),
        quantity: z.number().positive(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Rate limit stock adjustments per user
      checkRateLimit(`stock:adjust:${ctx.userId}`, procedureRateLimits.stockAdjust);

      const result = await stockService.addStock(
        input.productOptionId,
        input.quantity,
        ctx.userId,
        input.notes
      );

      // Audit log
      auditLogger.logStock(
        AuditEventType.STOCK_ADDED,
        input.productOptionId,
        ctx.userId,
        input.quantity,
        { notes: input.notes, newQuantity: result.newQuantity }
      );

      return result;
    }),

  /**
   * Remove stock from a product option (manual deduction) - tenant admin only
   */
  removeStock: tenantAdminProcedure
    .input(
      z.object({
        productOptionId: z.string().uuid(),
        quantity: z.number().positive(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Rate limit stock adjustments per user
      checkRateLimit(`stock:adjust:${ctx.userId}`, procedureRateLimits.stockAdjust);

      const result = await stockService.removeStock(
        input.productOptionId,
        input.quantity,
        ctx.userId,
        input.notes
      );

      // Audit log
      auditLogger.logStock(
        AuditEventType.STOCK_REMOVED,
        input.productOptionId,
        ctx.userId,
        input.quantity,
        { notes: input.notes, newQuantity: result.newQuantity }
      );

      return result;
    }),

  /**
   * Adjust stock (inventory reconciliation) - tenant admin only
   */
  adjustStock: tenantAdminProcedure
    .input(
      z.object({
        productOptionId: z.string().uuid(),
        newQuantity: z.number().min(0),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await stockService.adjustStock(
        input.productOptionId,
        input.newQuantity,
        ctx.userId,
        input.notes
      );

      // Audit log
      auditLogger.logStock(
        AuditEventType.STOCK_ADJUSTED,
        input.productOptionId,
        ctx.userId,
        result.newQuantity - result.previousQuantity,
        {
          notes: input.notes,
          previousQuantity: result.previousQuantity,
          newQuantity: result.newQuantity,
        }
      );

      return result;
    }),

  /**
   * Get stock movements history for a product option
   * Security: Restricted to tenant users, filters by tenant to prevent cross-tenant exposure
   */
  getMovements: tenantProcedure
    .input(
      z.object({
        productOptionId: z.string().uuid().optional(),
        type: z.nativeEnum(StockMovementType).optional(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      return stockService.getMovements({
        tenantId: ctx.tenantId,
        productOptionId: input.productOptionId,
        type: input.type,
        skip: input.skip,
        take: input.take,
      });
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
      return stockService.getStockLevels({
        tenantId: ctx.tenantId,
        category: input.category,
        lowStockOnly: input.lowStockOnly,
        skip: input.skip,
        take: input.take,
      });
    }),

  /**
   * Toggle product availability - tenant admin only
   */
  toggleAvailability: tenantAdminProcedure
    .input(
      z.object({
        productOptionId: z.string().uuid(),
        isAvailable: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await stockService.toggleAvailability(
        input.productOptionId,
        input.isAvailable
      );

      // Audit log
      auditLogger.logStock(
        input.isAvailable ? AuditEventType.STOCK_ADDED : AuditEventType.STOCK_REMOVED,
        input.productOptionId,
        ctx.userId,
        0,
        { action: "toggle_availability", isAvailable: input.isAvailable }
      );

      return result;
    }),

  /**
   * Validate stock availability for an order
   */
  validateForOrder: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ input }) => {
      return stockService.validateStockForOrder(input.orderId);
    }),
});
