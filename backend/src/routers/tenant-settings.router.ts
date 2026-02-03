import { z } from "zod";
import { router, tenantProcedure } from "../trpc";

/**
 * Tenant Settings Router
 * Manages business rules and configuration for tenants
 */

const deliveryTimeSlotSchema = z.record(
  z.string(), // day of week as string key
  z.array(z.string()) // array of time slots
);

export const tenantSettingsRouter = router({
  /**
   * Get tenant settings (creates default if doesn't exist)
   */
  get: tenantProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId!;

    // Get or create settings
    let settings = await ctx.prisma.tenantSettings.findUnique({
      where: { tenantId },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await ctx.prisma.tenantSettings.create({
        data: {
          tenantId,
          minDeliveryDaysAhead: 1,
          maxDeliveryDaysAhead: 30,
          deliveryDaysAllowed: [1, 2, 3, 4, 5], // Monday to Friday
          operatingDays: [1, 2, 3, 4, 5],
          allowSameDayOrders: false,
          autoConfirmOrders: false,
        },
      });
    }

    return settings;
  }),

  /**
   * Update tenant settings
   */
  update: tenantProcedure
    .input(
      z.object({
        minDeliveryDaysAhead: z.number().int().min(0).max(30).optional(),
        maxDeliveryDaysAhead: z.number().int().min(1).max(365).optional(),
        deliveryDaysAllowed: z.array(z.number().int().min(0).max(6)).optional(),
        deliveryTimeSlots: deliveryTimeSlotSchema.optional(),
        operatingDays: z.array(z.number().int().min(0).max(6)).optional(),
        allowSameDayOrders: z.boolean().optional(),
        autoConfirmOrders: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId!;

      // Validate that minDeliveryDaysAhead <= maxDeliveryDaysAhead
      if (
        input.minDeliveryDaysAhead !== undefined &&
        input.maxDeliveryDaysAhead !== undefined &&
        input.minDeliveryDaysAhead > input.maxDeliveryDaysAhead
      ) {
        throw new Error(
          "O prazo mínimo não pode ser maior que o prazo máximo"
        );
      }

      // Get or create settings first
      let settings = await ctx.prisma.tenantSettings.findUnique({
        where: { tenantId },
      });

      if (!settings) {
        // Create with provided values
        settings = await ctx.prisma.tenantSettings.create({
          data: {
            tenantId,
            ...input,
          },
        });
      } else {
        // Update existing
        settings = await ctx.prisma.tenantSettings.update({
          where: { tenantId },
          data: input,
        });
      }

      return settings;
    }),

  /**
   * Get available delivery dates based on settings
   */
  getAvailableDeliveryDates: tenantProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId!;

    const settings = await ctx.prisma.tenantSettings.findUnique({
      where: { tenantId },
    });

    if (!settings) {
      // Return defaults
      return {
        minDaysAhead: 1,
        maxDaysAhead: 30,
        allowedWeekdays: [1, 2, 3, 4, 5],
        allowSameDay: false,
      };
    }

    return {
      minDaysAhead: settings.minDeliveryDaysAhead,
      maxDaysAhead: settings.maxDeliveryDaysAhead,
      allowedWeekdays: settings.deliveryDaysAllowed as number[],
      allowSameDay: settings.allowSameDayOrders,
      timeSlots: settings.deliveryTimeSlots as Record<string, string[]> | null,
    };
  }),
});
