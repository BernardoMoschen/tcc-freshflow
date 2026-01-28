import { Request, Response, NextFunction } from "express";

/**
 * Security headers middleware (replaces helmet for simplicity)
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Content Security Policy
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';"
  );

  // Prevent XSS attacks
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  // HSTS (only in production)
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // Remove server signature
  res.removeHeader("X-Powered-By");

  next();
}

/**
 * CORS configuration
 */
export interface CorsConfig {
  origins: string[];
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

const defaultCorsConfig: CorsConfig = {
  origins: process.env.ALLOWED_ORIGINS?.split(",") || [
    "http://localhost:5173",
    "http://localhost:3000",
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Tenant-Id",
    "X-Account-Id",
    "X-Request-Id",
  ],
  exposedHeaders: [
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
    "X-Request-Id",
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
};

/**
 * Enhanced CORS middleware
 */
export function corsMiddleware(config: Partial<CorsConfig> = {}) {
  const finalConfig = { ...defaultCorsConfig, ...config };

  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    // Check if origin is allowed
    const isAllowed =
      !origin ||
      finalConfig.origins.includes("*") ||
      finalConfig.origins.includes(origin);

    if (isAllowed && origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }

    res.setHeader("Access-Control-Allow-Methods", finalConfig.methods.join(", "));
    res.setHeader("Access-Control-Allow-Headers", finalConfig.allowedHeaders.join(", "));
    res.setHeader("Access-Control-Expose-Headers", finalConfig.exposedHeaders.join(", "));
    res.setHeader("Access-Control-Max-Age", finalConfig.maxAge.toString());

    if (finalConfig.credentials) {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    // Handle preflight
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    next();
  };
}

/**
 * Request ID middleware for tracing
 */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = req.headers["x-request-id"] as string || generateRequestId();
  (req as any).requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomPart}`;
}

/**
 * Input sanitization middleware
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  // Sanitize body
  if (req.body && typeof req.body === "object") {
    sanitizeObject(req.body);
  }

  // Sanitize query params
  if (req.query && typeof req.query === "object") {
    sanitizeObject(req.query as Record<string, any>);
  }

  // Sanitize params
  if (req.params && typeof req.params === "object") {
    sanitizeObject(req.params as Record<string, any>);
  }

  next();
}

/**
 * Recursively sanitize object values
 */
function sanitizeObject(obj: Record<string, any>): void {
  for (const key of Object.keys(obj)) {
    const value = obj[key];

    if (typeof value === "string") {
      // Remove null bytes
      obj[key] = value.replace(/\0/g, "");
      // Limit string length to prevent DoS
      if (obj[key].length > 100000) {
        obj[key] = obj[key].substring(0, 100000);
      }
    } else if (typeof value === "object" && value !== null) {
      sanitizeObject(value);
    }
  }
}

/**
 * JSON body parser with size limits
 */
export function jsonParser(maxSize: string = "10mb") {
  const maxBytes = parseSize(maxSize);

  return (req: Request, res: Response, next: NextFunction): void => {
    // Check Content-Length header
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);
    if (contentLength > maxBytes) {
      res.status(413).json({
        error: "Payload Too Large",
        message: `Request body must be smaller than ${maxSize}`,
      });
      return;
    }

    next();
  };
}

/**
 * Parse size string to bytes
 */
function parseSize(size: string): number {
  const units: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+)(b|kb|mb|gb)?$/);
  if (!match) return 10 * 1024 * 1024; // Default 10MB

  const value = parseInt(match[1], 10);
  const unit = match[2] || "b";

  return value * units[unit];
}

/**
 * Error handling middleware (sanitizes error messages in production)
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as any).requestId || "unknown";

  // Log error with context
  console.error({
    error: err.message,
    stack: err.stack,
    requestId,
    path: req.path,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  // Don't leak error details in production
  const isDev = process.env.NODE_ENV === "development";
  const message = isDev ? err.message : "Internal server error";
  const stack = isDev ? err.stack : undefined;

  res.status(500).json({
    error: "Internal Server Error",
    message,
    requestId,
    ...(stack && { stack }),
  });
}

/**
 * Not found handler
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: "Not Found",
    message: `Cannot ${req.method} ${req.path}`,
    path: req.path,
  });
}
