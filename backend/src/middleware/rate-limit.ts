import { Request, Response, NextFunction } from "express";

/**
 * Extended Express Request with optional auth properties
 */
interface AuthenticatedRequest extends Request {
  userId?: string;
  requestId?: string;
}

/**
 * Rate limiter configuration
 */
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * Rate limit store (in-memory, can be replaced with Redis)
 */
class RateLimitStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Check if request should be rate limited
   */
  check(key: string, windowMs: number, maxRequests: number): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    const record = this.store.get(key);

    // No record or expired window
    if (!record || record.resetTime <= now) {
      this.store.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: now + windowMs,
      };
    }

    // Increment count
    record.count++;
    this.store.set(key, record);

    const allowed = record.count <= maxRequests;
    const remaining = Math.max(0, maxRequests - record.count);

    return {
      allowed,
      remaining,
      resetTime: record.resetTime,
    };
  }

  /**
   * Clean up expired entries (should be called periodically)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (record.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Decrement the count for a key (used when skipping failed requests)
   */
  decrementCount(key: string): void {
    const record = this.store.get(key);
    if (record) {
      record.count = Math.max(0, record.count - 1);
    }
  }
}

// Global store instance
const rateLimitStore = new RateLimitStore();

// Cleanup expired entries every minute
setInterval(() => rateLimitStore.cleanup(), 60 * 1000);

/**
 * Create rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = "Too many requests, please try again later",
    skipFailedRequests = false,
    keyGenerator = (req) => req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown",
  } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const result = rateLimitStore.check(key, windowMs, maxRequests);

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", result.remaining);
    res.setHeader("X-RateLimit-Reset", new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      res.setHeader("Retry-After", Math.ceil((result.resetTime - Date.now()) / 1000));
      res.status(429).json({
        error: "Too Many Requests",
        message,
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      });
      return;
    }

    // Skip counting failed requests if configured
    if (skipFailedRequests) {
      res.on("finish", () => {
        if (res.statusCode >= 400) {
          // Decrement count for failed requests
          rateLimitStore.decrementCount(key);
        }
      });
    }

    next();
  };
}

/**
 * Pre-configured rate limiters for different endpoints
 */
export const rateLimiters = {
  /**
   * Standard API rate limit: 100 requests per minute
   */
  standard: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  }),

  /**
   * Strict rate limit for auth endpoints: 10 requests per minute
   */
  auth: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: "Too many authentication attempts, please try again later",
    skipFailedRequests: true,
  }),

  /**
   * Relaxed rate limit for read operations: 200 requests per minute
   */
  read: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200,
  }),

  /**
   * Strict rate limit for write operations: 50 requests per minute
   */
  write: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50,
    message: "Too many write operations, please slow down",
  }),

  /**
   * Very strict for sensitive operations: 5 requests per minute
   */
  sensitive: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    message: "This operation is rate limited, please try again later",
  }),

  /**
   * Webhook rate limit: 1000 requests per minute (for external services)
   */
  webhook: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000,
    keyGenerator: (req) => req.path, // Rate limit per endpoint, not per IP
  }),

  /**
   * Per-user rate limit: uses user ID from JWT if available
   */
  perUser: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyGenerator: (req) => {
      // Try to get user ID from request (set by auth middleware)
      const authReq = req as AuthenticatedRequest;
      if (authReq.userId) return `user:${authReq.userId}`;
      return req.ip || "unknown";
    },
  }),
};

/**
 * Middleware to apply rate limiting based on request method
 */
export function adaptiveRateLimit(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();

  // Apply different limits based on HTTP method
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return rateLimiters.read(req, res, next);
  }

  if (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE") {
    return rateLimiters.write(req, res, next);
  }

  return rateLimiters.standard(req, res, next);
}
