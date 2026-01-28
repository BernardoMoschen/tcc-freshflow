import { TRPCError } from "@trpc/server";

/**
 * Custom error class for business logic errors
 */
export class BusinessError extends Error {
  constructor(
    message: string,
    public readonly code: string = "BUSINESS_ERROR"
  ) {
    super(message);
    this.name = "BusinessError";
  }
}

/**
 * Create user-friendly TRPC errors
 */
export const Errors = {
  notFound: (resource: string, id?: string) =>
    new TRPCError({
      code: "NOT_FOUND",
      message: id
        ? `${resource} with ID ${id} not found`
        : `${resource} not found`,
    }),

  unauthorized: (message: string = "You must be logged in to perform this action") =>
    new TRPCError({
      code: "UNAUTHORIZED",
      message,
    }),

  forbidden: (message: string = "You don't have permission to perform this action") =>
    new TRPCError({
      code: "FORBIDDEN",
      message,
    }),

  badRequest: (message: string) =>
    new TRPCError({
      code: "BAD_REQUEST",
      message,
    }),

  conflict: (message: string) =>
    new TRPCError({
      code: "CONFLICT",
      message,
    }),

  internal: (message: string = "An internal server error occurred") =>
    new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message,
    }),

  // Business-specific errors
  insufficientStock: (productName: string, available: number, required: number) =>
    new TRPCError({
      code: "BAD_REQUEST",
      message: `Insufficient stock for ${productName}. Available: ${available}, Required: ${required}`,
    }),

  orderAlreadyFinalized: (orderNumber: string) =>
    new TRPCError({
      code: "BAD_REQUEST",
      message: `Order ${orderNumber} has already been finalized and cannot be modified`,
    }),

  cannotWeighFixedItem: () =>
    new TRPCError({
      code: "BAD_REQUEST",
      message: "Cannot weigh a fixed-unit item. Only weight-based items can be weighed.",
    }),

  orderNotReady: (reason: string) =>
    new TRPCError({
      code: "BAD_REQUEST",
      message: `Order cannot be finalized: ${reason}`,
    }),
};

/**
 * Log error with structured format
 */
export function logError(error: unknown, context?: Record<string, any>) {
  const errorInfo = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString(),
  };

  console.error("🚨 Backend Error:", errorInfo);

  // In production, send to error tracking service (Sentry, etc.)
  // if (process.env.NODE_ENV === "production") {
  //   Sentry.captureException(error, { extra: context });
  // }
}

/**
 * Wrap async operations with error logging
 */
export async function withErrorLogging<T>(
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logError(error, context);
    throw error;
  }
}
