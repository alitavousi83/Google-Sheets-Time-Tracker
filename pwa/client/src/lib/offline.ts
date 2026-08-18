import Dexie, { type Table } from 'dexie';
import type { TimeEntry, Task, TimeBlock, Activity } from '../types';

interface SyncQueueItem {
  id?: number;
  method: string;
  path: string;
  body?: unknown;
  createdAt: string;
}

interface CachedTimer {
  userId: string;
  activityId: string;
  startedAt: string;
  pausedAt: string | null;
  accumulatedMs: number;
  notes: string | null;
  activityName: string;
  color: string;
  emoji: string;
}

class OfflineDB extends Dexie {
  timeEntries!: Table<TimeEntry>;
  tasks!: Table<Task>;
  timeBlocks!: Table<TimeBlock>;
  activities!: Table<Activity>;
  syncQueue!: Table<SyncQueueItem>;
  cachedTimer!: Table<CachedTimer>;

  constructor() {
    super('PremiumTimeTracker');
    this.version(1).stores({
      timeEntries: 'id, user_id, date, activity_id',
      tasks: 'id, user_id, date, completed',
      timeBlocks: 'id, [user_id+date+block_index], date',
      activities: 'id, user_id, sort_order',
      syncQueue: '++id, createdAt',
      cachedTimer: 'userId',
    });
  }
}

export const offlineDb = new OfflineDB();

export async function queueSync(method: string, path: string, body?: unknown) {
  await offlineDb.syncQueue.add({
    method,
    path,
    body,
    createdAt: new Date().toISOString(),
  });
}

export async function processSyncQueue(fetchFn: (method: string, path: string, body?: unknown) => Promise<unknown>) {
  const items = await offlineDb.syncQueue.orderBy('createdAt').toArray();
  for (const item of items) {
    try {
      await fetchFn(item.method, item.path, item.body);
      if (item.id) await offlineDb.syncQueue.delete(item.id);
    } catch {
      break;
    }
  }
}

export function isOnline(): boolean {
  return navigator.onLine;
}
