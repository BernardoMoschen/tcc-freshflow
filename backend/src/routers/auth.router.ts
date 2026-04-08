import { router, protectedProcedure } from "../trpc.js";
import { getUserMemberships } from "../rbac.js";
import { Errors } from "../lib/errors.js";

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
      throw Errors.notFound("User", ctx.userId);
    }

    const memberships = await getUserMemberships(ctx.userId);

    // Batch fetch all customers for account memberships (avoids N+1)
    const accountIds = memberships
      .filter((m) => m.account)
      .map((m) => m.account?.id)
      .filter((id): id is string => !!id);

    const customers =
      accountIds.length > 0
        ? await ctx.prisma.customer.findMany({
            where: { accountId: { in: accountIds } },
            select: { id: true, accountId: true },
          })
        : [];

    // Create lookup map for O(1) access
    const customerByAccountId = new Map(
      customers.map((c) => [c.accountId, c.id])
    );

    // Build memberships with customer IDs
    const membershipsWithCustomers = memberships.map((m) => ({
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
            customerId: customerByAccountId.get(m.account.id) || null,
            tenant: m.account.tenant
              ? {
                  id: m.account.tenant.id,
                  name: m.account.tenant.name,
                  slug: m.account.tenant.slug,
                }
              : null,
          }
        : null,
    }));

    return {
      user,
      memberships: membershipsWithCustomers,
    };
  }),
});
