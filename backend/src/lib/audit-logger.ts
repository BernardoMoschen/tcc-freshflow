import { Request } from "express";
import { PrismaClient, AuditEventType, AuditSeverity } from "@prisma/client";

// Re-export enums for convenience
export { AuditEventType, AuditSeverity };

/**
 * Audit log entry interface (matches Prisma model)
 */
export interface AuditLogEntry {
  id: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  action: string;
  success: boolean;
  userId?: string | null;
  tenantId?: string | null;
  accountId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  details?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  errorMessage?: string | null;
  createdAt: Date;
}

/**
 * Input for creating an audit log entry
 */
type AuditLogInput = Omit<AuditLogEntry, "id" | "createdAt">;

/**
 * Audit logger class with database persistence
 */
class AuditLogger {
  private prisma: PrismaClient | null = null;
  private fallbackLogs: AuditLogEntry[] = [];
  private maxFallbackLogs = 100;

  /**
   * Initialize with Prisma client
   */
  init(prisma: PrismaClient): void {
    this.prisma = prisma;
  }

  /**
   * Log an audit event
   */
  async log(entry: AuditLogInput): Promise<void> {
    // Always write to console for real-time monitoring
    this.writeToConsole(entry);

    // Write to database if initialized
    if (this.prisma) {
      try {
        await this.prisma.auditLog.create({
          data: {
            eventType: entry.eventType,
            severity: entry.severity,
            action: entry.action,
            success: entry.success,
            userId: entry.userId || null,
            tenantId: entry.tenantId || null,
            accountId: entry.accountId || null,
            resourceType: entry.resourceType || null,
            resourceId: entry.resourceId || null,
            details: entry.details || null,
            ipAddress: entry.ipAddress || null,
            userAgent: entry.userAgent || null,
            requestId: entry.requestId || null,
            errorMessage: entry.errorMessage || null,
          },
        });
      } catch (error) {
        // Log to console if database write fails
        console.error("Failed to write audit log to database:", error);
        this.storeFallback(entry);
      }
    } else {
      // Store in memory fallback if Prisma not initialized
      this.storeFallback(entry);
    }
  }

  /**
   * Store log in fallback memory storage
   */
  private storeFallback(entry: AuditLogInput): void {
    const logEntry: AuditLogEntry = {
      ...entry,
      id: this.generateId(),
      createdAt: new Date(),
    };

    this.fallbackLogs.push(logEntry);
    if (this.fallbackLogs.length > this.maxFallbackLogs) {
      this.fallbackLogs = this.fallbackLogs.slice(-this.maxFallbackLogs);
    }
  }

  /**
   * Log from Express request context
   */
  logRequest(
    req: Request,
    eventType: AuditEventType,
    action: string,
    options: {
      success?: boolean;
      severity?: AuditSeverity;
      resourceType?: string;
      resourceId?: string;
      details?: Record<string, any>;
      errorMessage?: string;
    } = {}
  ): void {
    // Fire and forget - don't await to avoid blocking requests
    this.log({
      eventType,
      action,
      success: options.success ?? true,
      severity: options.severity ?? AuditSeverity.INFO,
      userId: (req as any).userId,
      tenantId: (req as any).tenantId,
      accountId: (req as any).accountId,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      details: options.details,
      errorMessage: options.errorMessage,
      ipAddress: req.ip || req.headers["x-forwarded-for"]?.toString(),
      userAgent: req.headers["user-agent"],
      requestId: (req as any).requestId,
    }).catch((err) => console.error("Audit log failed:", err));
  }

  /**
   * Log authentication event
   */
  logAuth(
    eventType: AuditEventType.AUTH_LOGIN | AuditEventType.AUTH_LOGOUT | AuditEventType.AUTH_FAILED,
    userId: string | undefined,
    success: boolean,
    ipAddress?: string,
    details?: Record<string, any>
  ): void {
    this.log({
      eventType,
      action: eventType.replace("AUTH_", "").toLowerCase(),
      success,
      severity: success ? AuditSeverity.INFO : AuditSeverity.WARNING,
      userId,
      ipAddress,
      details,
    }).catch((err) => console.error("Audit log failed:", err));
  }

  /**
   * Log order event
   */
  logOrder(
    eventType: AuditEventType,
    orderId: string,
    userId: string,
    details?: Record<string, any>
  ): void {
    this.log({
      eventType,
      action: eventType.replace("ORDER_", "").toLowerCase(),
      success: true,
      severity: AuditSeverity.INFO,
      userId,
      resourceType: "Order",
      resourceId: orderId,
      details,
    }).catch((err) => console.error("Audit log failed:", err));
  }

  /**
   * Log stock event
   */
  logStock(
    eventType: AuditEventType,
    productOptionId: string,
    userId: string,
    quantity: number,
    details?: Record<string, any>
  ): void {
    this.log({
      eventType,
      action: eventType.replace("STOCK_", "").toLowerCase(),
      success: true,
      severity: AuditSeverity.INFO,
      userId,
      resourceType: "ProductOption",
      resourceId: productOptionId,
      details: { quantity, ...details },
    }).catch((err) => console.error("Audit log failed:", err));
  }

  /**
   * Log security event
   */
  logSecurity(
    action: string,
    userId: string | undefined,
    ipAddress: string | undefined,
    details?: Record<string, any>
  ): void {
    this.log({
      eventType: AuditEventType.SECURITY_VIOLATION,
      action,
      success: false,
      severity: AuditSeverity.CRITICAL,
      userId,
      ipAddress,
      details,
    }).catch((err) => console.error("Audit log failed:", err));
  }

  /**
   * Log system error
   */
  logError(
    action: string,
    errorMessage: string,
    details?: Record<string, any>
  ): void {
    this.log({
      eventType: AuditEventType.SYSTEM_ERROR,
      action,
      success: false,
      severity: AuditSeverity.ERROR,
      errorMessage,
      details,
    }).catch((err) => console.error("Audit log failed:", err));
  }

  /**
   * Get recent logs from database
   */
  async getRecentLogs(limit: number = 100): Promise<AuditLogEntry[]> {
    if (!this.prisma) {
      return this.fallbackLogs.slice(-limit).reverse();
    }

    const logs = await this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return logs as AuditLogEntry[];
  }

  /**
   * Get logs by user from database
   */
  async getLogsByUser(userId: string, limit: number = 100): Promise<AuditLogEntry[]> {
    if (!this.prisma) {
      return this.fallbackLogs
        .filter((log) => log.userId === userId)
        .slice(-limit)
        .reverse();
    }

    const logs = await this.prisma.auditLog.findMany({
      where: { userId },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return logs as AuditLogEntry[];
  }

  /**
   * Get logs by event type from database
   */
  async getLogsByEventType(eventType: AuditEventType, limit: number = 100): Promise<AuditLogEntry[]> {
    if (!this.prisma) {
      return this.fallbackLogs
        .filter((log) => log.eventType === eventType)
        .slice(-limit)
        .reverse();
    }

    const logs = await this.prisma.auditLog.findMany({
      where: { eventType },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return logs as AuditLogEntry[];
  }

  /**
   * Get logs by tenant from database
   */
  async getLogsByTenant(tenantId: string, limit: number = 100): Promise<AuditLogEntry[]> {
    if (!this.prisma) {
      return this.fallbackLogs
        .filter((log) => log.tenantId === tenantId)
        .slice(-limit)
        .reverse();
    }

    const logs = await this.prisma.auditLog.findMany({
      where: { tenantId },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return logs as AuditLogEntry[];
  }

  /**
   * Get logs with filters
   */
  async getLogs(options: {
    eventType?: AuditEventType;
    severity?: AuditSeverity;
    userId?: string;
    tenantId?: string;
    resourceType?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    skip?: number;
    take?: number;
  }): Promise<{ items: AuditLogEntry[]; total: number }> {
    if (!this.prisma) {
      // Fallback filtering
      let filtered = [...this.fallbackLogs];
      if (options.eventType) filtered = filtered.filter((l) => l.eventType === options.eventType);
      if (options.severity) filtered = filtered.filter((l) => l.severity === options.severity);
      if (options.userId) filtered = filtered.filter((l) => l.userId === options.userId);
      if (options.tenantId) filtered = filtered.filter((l) => l.tenantId === options.tenantId);

      const total = filtered.length;
      const items = filtered
        .slice(options.skip || 0, (options.skip || 0) + (options.take || 100))
        .reverse();

      return { items, total };
    }

    const where: any = {};
    if (options.eventType) where.eventType = options.eventType;
    if (options.severity) where.severity = options.severity;
    if (options.userId) where.userId = options.userId;
    if (options.tenantId) where.tenantId = options.tenantId;
    if (options.resourceType) where.resourceType = options.resourceType;
    if (options.resourceId) where.resourceId = options.resourceId;
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: options.skip || 0,
        take: options.take || 100,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items: items as AuditLogEntry[], total };
  }

  /**
   * Generate unique log ID for fallback storage
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `audit_${timestamp}_${random}`;
  }

  /**
   * Write log to console in structured format
   */
  private writeToConsole(entry: AuditLogInput): void {
    const logLevel = this.getLogLevel(entry.severity);
    const formatted = {
      type: "AUDIT",
      ...entry,
      timestamp: new Date().toISOString(),
    };

    // Use appropriate console method based on severity
    switch (logLevel) {
      case "error":
        console.error(JSON.stringify(formatted));
        break;
      case "warn":
        console.warn(JSON.stringify(formatted));
        break;
      default:
        console.log(JSON.stringify(formatted));
    }
  }

  /**
   * Map severity to console log level
   */
  private getLogLevel(severity: AuditSeverity): "log" | "warn" | "error" {
    switch (severity) {
      case AuditSeverity.CRITICAL:
      case AuditSeverity.ERROR:
        return "error";
      case AuditSeverity.WARNING:
        return "warn";
      default:
        return "log";
    }
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();

// Export middleware for automatic request logging
export function auditMiddleware(
  eventType: AuditEventType,
  resourceType?: string
) {
  return (req: Request, res: any, next: () => void) => {
    // Log after response
    res.on("finish", () => {
      const success = res.statusCode >= 200 && res.statusCode < 400;

      auditLogger.logRequest(req, eventType, req.method.toLowerCase(), {
        success,
        resourceType,
        resourceId: req.params.id || req.params.orderId,
        details: {
          statusCode: res.statusCode,
          path: req.path,
        },
        severity: success ? AuditSeverity.INFO : AuditSeverity.WARNING,
      });
    });

    next();
  };
}
