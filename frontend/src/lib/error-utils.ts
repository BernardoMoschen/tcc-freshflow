import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";

/**
 * Extract user-friendly error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  // TRPC errors
  if (error instanceof TRPCClientError) {
    return error.message || "An unexpected error occurred";
  }

  // Standard Error
  if (error instanceof Error) {
    return error.message;
  }

  // String errors
  if (typeof error === "string") {
    return error;
  }

  // Unknown error type
  return "An unexpected error occurred. Please try again.";
}

/**
 * Display error toast with user-friendly message
 */
export function showErrorToast(error: unknown, fallbackMessage?: string) {
  const message = getErrorMessage(error);

  toast.error(fallbackMessage || "Error", {
    description: message,
    duration: 5000,
  });

  // Log to console for debugging
  console.error("Error:", {
    message,
    error,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Handle async operation with automatic error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  options?: {
    successMessage?: string;
    errorMessage?: string;
    onSuccess?: (result: T) => void;
    onError?: (error: unknown) => void;
  }
): Promise<T | null> {
  try {
    const result = await operation();

    if (options?.successMessage) {
      toast.success(options.successMessage);
    }

    if (options?.onSuccess) {
      options.onSuccess(result);
    }

    return result;
  } catch (error) {
    showErrorToast(error, options?.errorMessage);

    if (options?.onError) {
      options.onError(error);
    }

    return null;
  }
}

/**
 * User-friendly error message mappings
 */
export const ERROR_MESSAGES = {
  // Authentication
  UNAUTHORIZED: "Please log in to continue",
  FORBIDDEN: "You don't have permission to perform this action",
  SESSION_EXPIRED: "Your session has expired. Please log in again",

  // Validation
  INVALID_INPUT: "Please check your input and try again",
  REQUIRED_FIELD: "Please fill in all required fields",

  // Not Found
  NOT_FOUND: "The requested item was not found",
  ORDER_NOT_FOUND: "Order not found",
  PRODUCT_NOT_FOUND: "Product not found",

  // Business Logic
  INSUFFICIENT_STOCK: "Insufficient stock available for this order",
  ORDER_ALREADY_FINALIZED: "This order has already been finalized",
  CANNOT_MODIFY_ORDER: "Cannot modify a finalized order",

  // Network
  NETWORK_ERROR: "Network error. Please check your connection and try again",
  TIMEOUT: "Request timed out. Please try again",
  SERVER_ERROR: "Server error. Please try again later",

  // Generic
  UNKNOWN_ERROR: "An unexpected error occurred. Please try again",
} as const;
