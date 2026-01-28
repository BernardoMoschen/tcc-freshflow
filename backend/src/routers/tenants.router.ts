import { router, protectedProcedure } from "../trpc.js";
import { TRPCError } from "@trpc/server";
import { RoleType } from "@prisma/client";

export const tenantsRouter = router({
  /**
   * List all tenants (platform admin only)
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    // Check if user is platform admin
    const membership = await ctx.prisma.membership.findFirst({
      where: {
        userId: ctx.userId,
        role: { name: RoleType.PLATFORM_ADMIN },
      },
    });

    if (!membership) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Platform admin access required",
      });
    }

    const tenants = await ctx.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: { name: "asc" },
    });

    return tenants;
  }),
});
