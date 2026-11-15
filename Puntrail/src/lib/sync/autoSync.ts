import { getDb } from '@/lib/db';
import { processSyncQueue } from '@/lib/sync/upload';

let isSyncing = false;

export async function runAutoSync(): Promise<{ success: number; failed: number; errors: string[] } | null> {
  if (isSyncing) return null;
  isSyncing = true;
  try {
    const db = await getDb();
    const pending = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM sync_queue WHERE status = 'pending' OR status = 'failed'"
    );

    if (!pending || pending.count === 0) return null;

    return await processSyncQueue();
  } catch (err) {
    console.warn('Auto-sync failed:', err);
    return null;
  } finally {
    isSyncing = false;
  }
}