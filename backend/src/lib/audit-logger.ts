import { Request } from "express";

/**
 * Audit event types
 */
export enum AuditEventType {
  // Authentication events
  AUTH_LOGIN = "AUTH_LOGIN",
  AUTH_LOGOUT = "AUTH_LOGOUT",
  AUTH_FAILED = "AUTH_FAILED",
  AUTH_TOKEN_REFRESH = "AUTH_TOKEN_REFRESH",

  // Order events
  ORDER_CREATED = "ORDER_CREATED",
  ORDER_UPDATED = "ORDER_UPDATED",
  ORDER_SUBMITTED = "ORDER_SUBMITTED",
  ORDER_FINALIZED = "ORDER_FINALIZED",
  ORDER_CANCELLED = "ORDER_CANCELLED",
  ORDER_ITEM_ADDED = "ORDER_ITEM_ADDED",
  ORDER_ITEM_REMOVED = "ORDER_ITEM_REMOVED",
  ORDER_ITEM_WEIGHED = "ORDER_ITEM_WEIGHED",

  // Stock events
  STOCK_ADDED = "STOCK_ADDED",
  STOCK_REMOVED = "STOCK_REMOVED",
  STOCK_ADJUSTED = "STOCK_ADJUSTED",
  STOCK_DEDUCTED = "STOCK_DEDUCTED",
  STOCK_RESTORED = "STOCK_RESTORED",

  // Product events
  PRODUCT_CREATED = "PRODUCT_CREATED",
  PRODUCT_UPDATED = "PRODUCT_UPDATED",
  PRODUCT_DELETED = "PRODUCT_DELETED",
  PRODUCT_OPTION_CREATED = "PRODUCT_OPTION_CREATED",
  PRODUCT_OPTION_UPDATED = "PRODUCT_OPTION_UPDATED",
  PRODUCT_OPTION_DELETED = "PRODUCT_OPTION_DELETED",

  // Customer events
  CUSTOMER_CREATED = "CUSTOMER_CREATED",
  CUSTOMER_UPDATED = "CUSTOMER_UPDATED",
  CUSTOMER_DELETED = "CUSTOMER_DELETED",
  CUSTOMER_PRICE_SET = "CUSTOMER_PRICE_SET",

  // Admin events
  USER_CREATED = "USER_CREATED",
  USER_UPDATED = "USER_UPDATED",
  USER_DELETED = "USER_DELETED",
  ROLE_ASSIGNED = "ROLE_ASSIGNED",
  ROLE_REMOVED = "ROLE_REMOVED",

  // System events
  SYSTEM_ERROR = "SYSTEM_ERROR",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  SECURITY_VIOLATION = "SECURITY_VIOLATION",
}

/**
 * Audit event severity levels
 */
export enum AuditSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  CRITICAL = "CRITICAL",
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  tenantId?: string;
  accountId?: string;
  resourceType?: string;
  resourceId?: string;
  action: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  success: boolean;
  errorMessage?: string;
}

/**
 * Audit logger class
 */
class AuditLogger {
  private logs: AuditLogEntry[] = [];
  private maxLogsInMemory = 1000;

  /**
   * Log an audit event
   */
  log(entry: Omit<AuditLogEntry, "id" | "timestamp">): void {
    const logEntry: AuditLogEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: new Date(),
    };

    // Store in memory (for demo, should be stored in database/external service)
    this.logs.push(logEntry);

    // Trim logs if too many
    if (this.logs.length > this.maxLogsInMemory) {
      this.logs = this.logs.slice(-this.maxLogsInMemory);
    }

    // Also log to console in structured format
    this.writeToConsole(logEntry);
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
    });
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
    });
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
    });
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
    });
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
    });
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
    });
  }

  /**
   * Get recent logs (for admin dashboard)
   */
  getRecentLogs(limit: number = 100): AuditLogEntry[] {
    return this.logs.slice(-limit).reverse();
  }

  /**
   * Get logs by user
   */
  getLogsByUser(userId: string, limit: number = 100): AuditLogEntry[] {
    return this.logs
      .filter((log) => log.userId === userId)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get logs by event type
   */
  getLogsByEventType(eventType: AuditEventType, limit: number = 100): AuditLogEntry[] {
    return this.logs
      .filter((log) => log.eventType === eventType)
      .slice(-limit)
      .reverse();
  }

  /**
   * Generate unique log ID
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `audit_${timestamp}_${random}`;
  }

  /**
   * Write log to console in structured format
   */
  private writeToConsole(entry: AuditLogEntry): void {
    const logLevel = this.getLogLevel(entry.severity);
    const formatted = {
      type: "AUDIT",
      ...entry,
      timestamp: entry.timestamp.toISOString(),
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
