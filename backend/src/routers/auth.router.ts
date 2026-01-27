import { router, protectedProcedure } from "../trpc.js";
import { getUserMemberships } from "../rbac.js";

export const authRouter = router({
  /**
   * Get current user session with memberships
   */
  session: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        email: true,
        name: true,
        supabaseId: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const memberships = await getUserMemberships(ctx.userId);

    return {
      user,
      memberships: memberships.map((m) => ({
        id: m.id,
        role: m.role.name,
        tenant: m.tenant
          ? {
              id: m.tenant.id,
              name: m.tenant.name,
              slug: m.tenant.slug,
            }
          : null,
        account: m.account
          ? {
              id: m.account.id,
              name: m.account.name,
              slug: m.account.slug,
              tenantId: m.account.tenantId,
              tenant: m.account.tenant
                ? {
                    id: m.account.tenant.id,
                    name: m.account.tenant.name,
                    slug: m.account.tenant.slug,
                  }
                : null,
            }
          : null,
      })),
    };
  }),
});
