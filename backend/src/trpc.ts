import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { authenticateRequest } from "./auth.js";
import { requireTenantAccess, requireAccountAccess } from "./rbac.js";
import { prisma } from "./db/prisma.js";

/**
 * Create tRPC context from Express request
 */
export async function createContext({ req, res }: CreateExpressContextOptions) {
  // Extract headers
  const authHeader = req.headers.authorization;
  const tenantId = req.headers["x-tenant-id"] as string | undefined;
  const accountId = req.headers["x-account-id"] as string | undefined;

  // Attempt authentication (returns userId or null)
  let userId: string | null = null;
  try {
    if (authHeader) {
      userId = await authenticateRequest(authHeader);
    }
  } catch (error) {
    // Don't throw here - let individual procedures decide if auth is required
    console.error("Auth error:", error);
  }

  return {
    req,
    res,
    userId,
    tenantId,
    accountId,
    prisma,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

/**
 * Initialize tRPC
 */
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.code === "BAD_REQUEST" && error.cause
            ? error.cause
            : null,
      },
    };
  },
});

/**
 * Public procedure (no auth required)
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure (requires valid JWT)
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId, // TypeScript now knows userId is non-null
    },
  });
});

/**
 * Tenant procedure (requires valid JWT + x-tenant-id header + membership)
 */
export const tenantProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.tenantId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "x-tenant-id header is required",
    });
  }

  try {
    await requireTenantAccess(ctx.userId, ctx.tenantId);
  } catch (error) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: error instanceof Error ? error.message : "Access denied",
    });
  }

  return next({
    ctx: {
      ...ctx,
      tenantId: ctx.tenantId, // TypeScript now knows tenantId is non-null
    },
  });
});

/**
 * Account procedure (requires valid JWT + x-account-id header + membership)
 */
export const accountProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.accountId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "x-account-id header is required",
    });
  }

  try {
    await requireAccountAccess(ctx.userId, ctx.accountId);
  } catch (error) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: error instanceof Error ? error.message : "Access denied",
    });
  }

  return next({
    ctx: {
      ...ctx,
      accountId: ctx.accountId, // TypeScript now knows accountId is non-null
    },
  });
});

/**
 * Export router and procedure helpers
 */
export const router = t.router;
export const middleware = t.middleware;
