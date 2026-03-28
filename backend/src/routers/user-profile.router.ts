import { z } from "zod";
import { Prisma } from "@prisma/client";
import { router, protectedProcedure } from "../trpc";

/**
 * User Profile Router
 * Manages user profile data and preferences
 */

export const userProfileRouter = router({
  /**
   * Get current user's profile
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      include: {
        preferences: true,
        memberships: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                cnpj: true,
                razaoSocial: true,
                phone: true,
                address: true,
                deliveryAddress: true,
              },
            },
            account: {
              select: {
                id: true,
                name: true,
              },
            },
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    return user;
  }),

  /**
   * Update user profile
   */
  update: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        phone: z.string().min(10).max(20).optional().nullable(),
        contactEmail: z.string().email().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: input,
      });

      return user;
    }),

  /**
   * Get user preferences (creates default if doesn't exist)
   */
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    let preferences = await ctx.prisma.userPreferences.findUnique({
      where: { userId: ctx.userId },
    });

    // Create default preferences if they don't exist
    if (!preferences) {
      preferences = await ctx.prisma.userPreferences.create({
        data: {
          userId: ctx.userId,
          theme: "light",
          density: "comfortable",
          notifyOrderStatus: true,
          notifyLowStock: true,
          notifyNewOrders: true,
        },
      });
    }

    return preferences;
  }),

  /**
   * Update user preferences
   */
  updatePreferences: protectedProcedure
    .input(
      z.object({
        theme: z.enum(["light", "dark", "system"]).optional(),
        density: z.enum(["comfortable", "compact"]).optional(),
        notifyOrderStatus: z.boolean().optional(),
        notifyLowStock: z.boolean().optional(),
        notifyNewOrders: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get or create preferences
      let preferences = await ctx.prisma.userPreferences.findUnique({
        where: { userId: ctx.userId },
      });

      if (!preferences) {
        preferences = await ctx.prisma.userPreferences.create({
          data: {
            userId: ctx.userId,
            ...input,
          },
        });
      } else {
        preferences = await ctx.prisma.userPreferences.update({
          where: { userId: ctx.userId },
          data: input,
        });
      }

      return preferences;
    }),

  /**
   * Update tenant profile data (for tenant admins)
   */
  updateTenantProfile: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        cnpj: z.string().min(14).max(18).optional().nullable(),
        razaoSocial: z.string().min(1).max(200).optional().nullable(),
        phone: z.string().min(10).max(20).optional().nullable(),
        address: z
          .object({
            street: z.string(),
            number: z.string(),
            complement: z.string().optional(),
            neighborhood: z.string(),
            city: z.string(),
            state: z.string().length(2), // Brazilian state code (SP, RJ, etc.)
            zipCode: z.string().length(8), // CEP without dash
          })
          .optional()
          .nullable(),
        deliveryAddress: z
          .object({
            street: z.string(),
            number: z.string(),
            complement: z.string().optional(),
            neighborhood: z.string(),
            city: z.string(),
            state: z.string().length(2),
            zipCode: z.string().length(8),
          })
          .optional()
          .nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId, address, deliveryAddress, ...rest } = input;
      const updateData = {
        ...rest,
        address: address === null ? Prisma.JsonNull : address,
        deliveryAddress: deliveryAddress === null ? Prisma.JsonNull : deliveryAddress,
      };

      // Verify user has permission for this tenant
      const membership = await ctx.prisma.membership.findFirst({
        where: {
          userId: ctx.userId,
          tenantId,
          role: {
            name: {
              in: ["TENANT_OWNER", "TENANT_ADMIN"],
            },
          },
        },
      });

      if (!membership) {
        throw new Error(
          "Você não tem permissão para atualizar este perfil de tenant"
        );
      }

      const tenant = await ctx.prisma.tenant.update({
        where: { id: tenantId },
        data: updateData,
      });

      return tenant;
    }),
});
