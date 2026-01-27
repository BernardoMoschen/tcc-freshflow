import Dexie, { Table } from "dexie";

export interface QueuedWeighing {
  id?: number;
  orderItemId: string;
  actualWeight: number;
  finalPrice?: number;
  notes?: string;
  photoUrl?: string;
  persistPrice: boolean;
  timestamp: number;
  synced: boolean;
}

class OfflineDatabase extends Dexie {
  queue!: Table<QueuedWeighing>;

  constructor() {
    super("freshflow-offline");
    this.version(1).stores({
      queue: "++id, orderItemId, timestamp, synced",
    });
  }
}

export const db = new OfflineDatabase();

/**
 * Queue a weighing operation for offline sync
 */
export async function queueWeighing(weighing: Omit<QueuedWeighing, "id" | "timestamp" | "synced">) {
  await db.queue.add({
    ...weighing,
    timestamp: Date.now(),
    synced: false,
  });
}

/**
 * Get all unsynced weighings
 */
export async function getUnsyncedWeighings(): Promise<QueuedWeighing[]> {
  return db.queue.where("synced").equals(false).toArray();
}

/**
 * Mark weighing as synced
 */
export async function markWeighingSynced(id: number): Promise<void> {
  await db.queue.update(id, { synced: true });
}

/**
 * Delete synced weighings (cleanup)
 */
export async function deleteSyncedWeighings(): Promise<void> {
  await db.queue.where("synced").equals(true).delete();
}

/**
 * Get queue status (count of unsynced items)
 */
export async function getQueueStatus(): Promise<{ pending: number }> {
  const pending = await db.queue.where("synced").equals(false).count();
  return { pending };
}

/**
 * Clear entire queue (use with caution)
 */
export async function clearQueue(): Promise<void> {
  await db.queue.clear();
}
