import { EventEmitter } from "events";
import { OrderStatus } from "@prisma/client";

/**
 * Order event types
 */
export enum OrderEventType {
  CREATED = "order:created",
  UPDATED = "order:updated",
  STATUS_CHANGED = "order:status_changed",
  ITEM_ADDED = "order:item_added",
  ITEM_REMOVED = "order:item_removed",
  WEIGHING_COMPLETED = "order:weighing_completed",
  FINALIZED = "order:finalized",
}

/**
 * Order event payload
 */
export interface OrderEvent {
  type: OrderEventType;
  orderId: string;
  accountId: string;
  tenantId: string;
  status?: OrderStatus;
  data?: Record<string, any>;
  timestamp: string;
}

/**
 * Global event emitter for order events
 * Used for real-time updates via SSE
 */
class OrderEventEmitter extends EventEmitter {
  /**
   * Emit an order event
   */
  emitOrderEvent(event: OrderEvent): void {
    // Emit to specific channels
    this.emit(`order:${event.orderId}`, event);
    this.emit(`account:${event.accountId}`, event);
    this.emit(`tenant:${event.tenantId}`, event);
    this.emit("order:all", event);
  }

  /**
   * Subscribe to order events for a specific order
   */
  onOrderEvent(orderId: string, callback: (event: OrderEvent) => void): () => void {
    this.on(`order:${orderId}`, callback);
    return () => this.off(`order:${orderId}`, callback);
  }

  /**
   * Subscribe to order events for an account
   */
  onAccountEvents(accountId: string, callback: (event: OrderEvent) => void): () => void {
    this.on(`account:${accountId}`, callback);
    return () => this.off(`account:${accountId}`, callback);
  }

  /**
   * Subscribe to order events for a tenant
   */
  onTenantEvents(tenantId: string, callback: (event: OrderEvent) => void): () => void {
    this.on(`tenant:${tenantId}`, callback);
    return () => this.off(`tenant:${tenantId}`, callback);
  }

  /**
   * Subscribe to all order events
   */
  onAllEvents(callback: (event: OrderEvent) => void): () => void {
    this.on("order:all", callback);
    return () => this.off("order:all", callback);
  }
}

// Global singleton instance
export const orderEvents = new OrderEventEmitter();

// Set max listeners to prevent memory leak warnings
orderEvents.setMaxListeners(100);
