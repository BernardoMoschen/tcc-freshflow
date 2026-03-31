import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "./use-auth";
import { trpc } from "@/lib/trpc";

/**
 * Order event types (matches backend)
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
 * Order event payload (matches backend)
 */
export interface OrderEvent {
  type: OrderEventType;
  orderId: string;
  accountId: string;
  tenantId: string;
  status?: string;
  data?: Record<string, any>;
  timestamp: string;
}

/**
 * Hook to subscribe to real-time order events via SSE
 * Automatically reconnects on disconnect
 */
export function useOrderEvents(
  onEvent: (event: OrderEvent) => void,
  enabled: boolean = true
) {
  const { user, session } = useAuth();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const utils = trpc.useUtils();

  const connect = useCallback(() => {
    if (!enabled || !user || !session) {
      return;
    }

    // Don't create multiple connections
    if (eventSourceRef.current) {
      return;
    }

    // Construct SSE URL (relative — Vite proxy handles /api in dev)
    let url = `/api/v1/orders/events`;

    // Add dev mode header as query param if needed
    if (import.meta.env.DEV) {
      const devUserEmail = localStorage.getItem("freshflow:dev-user-email");
      if (devUserEmail) {
        url += `?dev-user-email=${encodeURIComponent(devUserEmail)}`;
      }
    }

    console.log("🔌 Connecting to order events SSE:", url);

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log("✅ SSE connection established");
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle connection message
        if (data.type === "connected") {
          console.log("📡 SSE connected at", data.timestamp);
          return;
        }

        // Handle order events
        console.log("📬 Received order event:", data.type, data.orderId);
        onEvent(data as OrderEvent);

        // Invalidate relevant queries to refetch data
        void utils.orders.list.invalidate();
        void utils.orders.adminList.invalidate();
      } catch (error) {
        console.error("Failed to parse SSE message:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("❌ SSE connection error:", error);
      eventSource.close();
      eventSourceRef.current = null;

      // Attempt to reconnect after 5 seconds
      if (enabled) {
        console.log("🔄 Reconnecting in 5 seconds...");
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      }
    };
  }, [enabled, user, session, onEvent, utils]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      console.log("🔌 Disconnecting from order events SSE");
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Connect/disconnect based on enabled state and auth
  useEffect(() => {
    if (enabled && user && session) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, user, session, connect, disconnect]);

  return {
    isConnected: eventSourceRef.current !== null && eventSourceRef.current.readyState === EventSource.OPEN,
    reconnect: connect,
    disconnect,
  };
}
