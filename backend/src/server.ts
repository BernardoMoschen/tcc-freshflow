import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./router.js";
import { createContext } from "./trpc.js";
import { generateDeliveryNotePDF } from "./pdf/statement.js";
import { authenticateRequest } from "./auth.js";
import { canAccessAccount } from "./rbac.js";
import { prisma } from "./db/prisma.js";
import { handleIncomingMessage } from "./lib/whatsapp.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.VITE_API_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// PDF delivery note endpoint
app.get("/api/delivery-note/:orderId.pdf", async (req, res) => {
  try {
    const { orderId } = req.params;
    const authHeader = req.headers.authorization as string | undefined;

    // Authenticate request
    let userId: string;
    try {
      userId = await authenticateRequest(authHeader);
    } catch (error) {
      return res.status(401).json({
        error: "Authentication required",
        message: error instanceof Error ? error.message : "Unknown error",
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
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if user can access this order's account
    const hasAccess = await canAccessAccount(userId, order.accountId);

    if (!hasAccess) {
      return res.status(403).json({
        error: "Access denied",
        message: "You do not have permission to access this order",
      });
    }

    // Generate PDF
    const pdfBuffer = await generateDeliveryNotePDF(orderId);

    // Send PDF response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="delivery-note-${order.orderNumber}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({
      error: "PDF generation failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// WhatsApp webhook endpoint (Twilio)
app.post("/api/whatsapp/webhook", async (req, res) => {
  try {
    const { From, Body } = req.body;

    if (!From || !Body) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "From and Body are required",
      });
    }

    console.log(`[WhatsApp Webhook] Received message from ${From}: ${Body}`);

    // Process incoming message and get auto-reply if available
    const reply = await handleIncomingMessage(From, Body);

    if (reply) {
      // Twilio expects TwiML response for auto-reply
      res.setHeader("Content-Type", "text/xml");
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${reply}</Message>
</Response>`);
    } else {
      // No auto-reply, just acknowledge receipt
      res.status(200).json({ status: "received" });
    }
  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    res.status(500).json({
      error: "Webhook processing failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// tRPC endpoint
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path,
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Server error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 FreshFlow backend running on http://localhost:${PORT}`);
  console.log(`📊 tRPC endpoint: http://localhost:${PORT}/trpc`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n👋 Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n👋 Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});
