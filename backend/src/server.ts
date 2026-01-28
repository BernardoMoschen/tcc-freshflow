import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./router.js";
import { createContext } from "./trpc.js";
import { generateDeliveryNotePDF } from "./pdf/statement.js";
import { authenticateRequest } from "./auth.js";
import { canAccessAccount } from "./rbac.js";
import { prisma } from "./db/prisma.js";
import { handleIncomingMessage } from "./lib/whatsapp.js";
import { cache } from "./lib/cache.js";
import { auditLogger, AuditEventType, AuditSeverity } from "./lib/audit-logger.js";
import { validateEnv } from "./lib/env.js";
import { logger } from "./lib/logger.js";

// Import middleware
import { rateLimiters, adaptiveRateLimit } from "./middleware/rate-limit.js";
import {
  securityHeaders,
  corsMiddleware,
  requestId,
  sanitizeInput,
  jsonParser,
  errorHandler,
  notFoundHandler,
} from "./middleware/security.js";

// Validate environment variables at startup (fail fast)
const env = validateEnv();

const app = express();
const PORT = env.PORT || 3001;

// ========== Security Middleware (order matters!) ==========

// 1. Request ID for tracing
app.use(requestId);

// 2. Security headers
app.use(securityHeaders);

// 3. CORS configuration
app.use(corsMiddleware({
  origins: process.env.ALLOWED_ORIGINS?.split(",") || [
    "http://localhost:5173",
    "http://localhost:3000",
  ],
}));

// 4. JSON body parser with size limit
app.use(express.json({ limit: "10mb" }));
app.use(jsonParser("10mb"));

// 5. Input sanitization
app.use(sanitizeInput);

// 6. Global rate limiting
app.use(adaptiveRateLimit);

// ========== Health Check (no auth required) ==========
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    cache: cache.isAvailable() ? "connected" : "memory-only",
    version: process.env.npm_package_version || "1.0.0",
  });
});

// ========== API Versioning ==========
// All API routes go under /api/v1
const apiV1 = express.Router();

// ========== PDF Delivery Note Endpoint ==========
apiV1.get("/delivery-note/:orderId.pdf", rateLimiters.read, async (req, res) => {
  const requestIdHeader = (req as any).requestId;

  try {
    const { orderId } = req.params;
    const authHeader = req.headers.authorization as string | undefined;

    // Authenticate request
    let userId: string;
    try {
      userId = await authenticateRequest(authHeader);
    } catch (error) {
      auditLogger.logRequest(req, AuditEventType.AUTH_FAILED, "pdf_access", {
        success: false,
        severity: AuditSeverity.WARNING,
        details: { orderId },
      });

      return res.status(401).json({
        error: "Authentication required",
        message: error instanceof Error ? error.message : "Unknown error",
        requestId: requestIdHeader,
      });
    }

    // Get order to check access
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        accountId: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        error: "Order not found",
        requestId: requestIdHeader,
      });
    }

    // Check if user can access this order's account
    const hasAccess = await canAccessAccount(userId, order.accountId);

    if (!hasAccess) {
      auditLogger.logRequest(req, AuditEventType.SECURITY_VIOLATION, "unauthorized_pdf_access", {
        success: false,
        severity: AuditSeverity.WARNING,
        resourceType: "Order",
        resourceId: orderId,
        details: { userId, accountId: order.accountId },
      });

      return res.status(403).json({
        error: "Access denied",
        message: "You do not have permission to access this order",
        requestId: requestIdHeader,
      });
    }

    // Generate PDF
    const pdfBuffer = await generateDeliveryNotePDF(orderId);

    // Log successful access
    auditLogger.logRequest(req, AuditEventType.ORDER_UPDATED, "pdf_generated", {
      success: true,
      resourceType: "Order",
      resourceId: orderId,
      details: { orderNumber: order.orderNumber },
    });

    // Send PDF response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="delivery-note-${order.orderNumber}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    res.setHeader("Cache-Control", "private, max-age=300"); // Cache for 5 minutes

    return res.send(pdfBuffer);
  } catch (error) {
    logger.error("Error generating PDF:", error);

    auditLogger.logError("pdf_generation", error instanceof Error ? error.message : "Unknown error", {
      orderId: req.params.orderId,
    });

    return res.status(500).json({
      error: "PDF generation failed",
      message: error instanceof Error ? error.message : "Unknown error",
      requestId: requestIdHeader,
    });
  }
});

// ========== WhatsApp Webhook Endpoint ==========
apiV1.post("/whatsapp/webhook", rateLimiters.webhook, async (req, res) => {
  try {
    const { From, Body } = req.body;

    if (!From || !Body) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "From and Body are required",
      });
    }

    logger.info(`[WhatsApp Webhook] Received message from ${From}: ${Body}`);

    // Process incoming message and get auto-reply if available
    const reply = await handleIncomingMessage(From, Body);

    if (reply) {
      // Twilio expects TwiML response for auto-reply
      res.setHeader("Content-Type", "text/xml");
      return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${reply}</Message>
</Response>`);
    } else {
      // No auto-reply, just acknowledge receipt
      return res.status(200).json({ status: "received" });
    }
  } catch (error) {
    logger.error("WhatsApp webhook error:", error);

    auditLogger.logError("whatsapp_webhook", error instanceof Error ? error.message : "Unknown error");

    return res.status(500).json({
      error: "Webhook processing failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Mount API v1 routes
app.use("/api/v1", apiV1);

// Also support legacy routes (without /api/v1 prefix) for backward compatibility
app.use("/api", apiV1);

// ========== tRPC Endpoint ==========
app.use(
  "/trpc",
  rateLimiters.standard,
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError: ({ error, path }) => {
      logger.error(`tRPC Error on ${path}:`, error);

      auditLogger.logError(`trpc_${path}`, error.message, {
        path,
        code: error.code,
      });
    },
  })
);

// ========== Error Handling ==========
app.use(notFoundHandler);
app.use(errorHandler);

// ========== Server Startup ==========
async function startServer() {
  // Initialize cache connection
  await cache.connect();

  // Start server
  app.listen(PORT, () => {
    logger.banner([
      `\n🚀 FreshFlow Backend v1.0.0`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📡 Server:     http://localhost:${PORT}`,
      `📊 tRPC:       http://localhost:${PORT}/trpc`,
      `📄 API v1:     http://localhost:${PORT}/api/v1`,
      `🏥 Health:     http://localhost:${PORT}/health`,
      `🔒 Security:   Headers, CORS, Rate Limiting enabled`,
      `📦 Cache:      ${cache.isAvailable() ? "Redis connected" : "In-memory mode"}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`,
    ]);
  });
}

// ========== Graceful Shutdown ==========
async function shutdown(signal: string) {
  logger.info(`\n👋 Received ${signal}, shutting down gracefully...`);

  try {
    await cache.disconnect();
    await prisma.$disconnect();
    logger.info("✅ All connections closed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  auditLogger.logError("uncaught_exception", error.message, { stack: error.stack });
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection:", reason);
  auditLogger.logError("unhandled_rejection", String(reason));
});

// Start the server
startServer().catch((error) => {
  logger.error("Failed to start server:", error);
  process.exit(1);
});
