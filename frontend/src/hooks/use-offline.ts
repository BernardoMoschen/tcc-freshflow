import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { trpc } from "@/lib/trpc";
import {
  getUnsyncedWeighings,
  markWeighingSynced,
  getQueueStatus,
} from "@/lib/offline";

export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  const weighMutation = trpc.orders.weigh.useMutation();

  // Live query for queue status
  const queueStatus = useLiveQuery(getQueueStatus);
  const unsyncedItems = useLiveQuery(getUnsyncedWeighings);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && unsyncedItems && unsyncedItems.length > 0 && !isSyncing) {
      syncQueue();
    }
  }, [isOnline, unsyncedItems]);

  const syncQueue = async () => {
    if (!unsyncedItems || unsyncedItems.length === 0 || isSyncing) {
      return;
    }

    setIsSyncing(true);

    try {
      for (const item of unsyncedItems) {
        try {
          await weighMutation.mutateAsync({
            orderItemId: item.orderItemId,
            actualWeight: item.actualWeight,
            finalPrice: item.finalPrice,
            notes: item.notes,
            photoUrl: item.photoUrl,
            persistPrice: item.persistPrice,
          });

          // Mark as synced
          if (item.id) {
            await markWeighingSynced(item.id);
          }
        } catch (error) {
          console.error("Failed to sync item:", item, error);
          // Continue with next item on error (last-write-wins)
        }
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    isOnline,
    isSyncing,
    pending: queueStatus?.pending || 0,
    syncQueue,
  };
}
