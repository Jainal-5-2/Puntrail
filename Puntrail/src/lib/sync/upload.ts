import { getDb } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import type { SyncQueueEntry } from '@/types';

export async function processSyncQueue(): Promise<{ success: number; failed: number; errors: string[] }> {
  const db = await getDb();
  let successCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  const pendingJobs = await db.getAllAsync<SyncQueueEntry>(
    "SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC"
  );

  if (pendingJobs.length === 0) return { success: 0, failed: 0, errors: [] };

  for (const job of pendingJobs) {
    try {
      await db.runAsync(
        "UPDATE sync_queue SET status = 'in_progress', updated_at = ? WHERE id = ?",
        new Date().toISOString(),
        job.id
      );

      if (job.entity_type === 'burial' && job.operation === 'update') {
        const payload = JSON.parse(job.payload as unknown as string);
        const { data, error } = await supabase
          .from('burials')
          .update({ status: payload.status })
          .eq('id', job.entity_id)
          .select('version')
          .single();

        if (error) throw error;
        if (data) {
          await db.runAsync(
            'UPDATE burials SET version = ?, synced_at = ? WHERE id = ?',
            data.version,
            new Date().toISOString(),
            job.entity_id
          );
        }
      } 
      else if (job.entity_type === 'plot' && job.operation === 'insert') {
        const payload = JSON.parse(job.payload as unknown as string);
        const localPlot = await db.getFirstAsync<any>('SELECT * FROM plots WHERE id = ?', job.entity_id);
        if (!localPlot) throw new Error('Local plot missing.');

        const { data, error } = await supabase
          .from('plots')
          .insert({
            id: localPlot.id,
            cemetery_id: localPlot.cemetery_id,
            section_id: localPlot.section_id,
            plot_identifier: localPlot.plot_identifier,
            geometry: payload.geometry,
            geometry_source: localPlot.geometry_source,
            geometry_verified: localPlot.geometry_verified === 1,
          })
          .select('version')
          .single();

        if (error) throw error;
        if (data) {
          await db.runAsync(
            'UPDATE plots SET version = ?, synced_at = ? WHERE id = ?',
            data.version,
            new Date().toISOString(),
            job.entity_id
          );
        }
      }
      else if (job.entity_type === 'cemetery' && job.operation === 'insert') {
        const payload = JSON.parse(job.payload as unknown as string);
        
        const { data, error } = await supabase
          .from('cemeteries')
          .insert({
            id: payload.id,
            name: payload.name,
            location: payload.location,
            notes: payload.notes,
            boundary: null, // Update when we add boundary drawing
          })
          .select('version')
          .single();

        if (error) throw error;
        if (data) {
          await db.runAsync(
            'UPDATE cemeteries SET version = ?, synced_at = ? WHERE id = ?',
            data.version,
            new Date().toISOString(),
            job.entity_id
          );
        }
      }

      await db.runAsync(
        "UPDATE sync_queue SET status = 'synced', updated_at = ? WHERE id = ?",
        new Date().toISOString(),
        job.id
      );
      successCount++;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMsg);
      
      await db.runAsync(
        "UPDATE sync_queue SET status = 'failed', last_error = ?, attempts = attempts + 1, updated_at = ? WHERE id = ?",
        errorMsg,
        new Date().toISOString(),
        job.id
      );
      failedCount++;
    }
  }

  return { success: successCount, failed: failedCount, errors };
}

export async function queueBurialUpdate(burialId: string, status: string, baseVersion: number): Promise<void> {
  const db = await getDb();
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  await db.runAsync(
    `INSERT INTO sync_queue (
       id, entity_type, entity_id, operation, payload, 
       base_version, status, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    jobId,
    'burial',
    burialId,
    'update',
    JSON.stringify({ status }),
    baseVersion,
    'pending',
    new Date().toISOString(),
    new Date().toISOString()
  );
}

export async function queuePlotCreate(plotId: string, geometry: any, plotIdentifier: string): Promise<void> {
  const db = await getDb();
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  await db.runAsync(
    `INSERT INTO sync_queue (
       id, entity_type, entity_id, operation, payload, 
       base_version, status, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    jobId,
    'plot',
    plotId,
    'insert',
    JSON.stringify({ geometry, plot_identifier: plotIdentifier }),
    0,
    'pending',
    new Date().toISOString(),
    new Date().toISOString()
  );
}

export async function queueCemeteryCreate(cemeteryId: string, data: any): Promise<void> {
  const db = await getDb();
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  await db.runAsync(
    `INSERT INTO sync_queue (
       id, entity_type, entity_id, operation, payload, 
       base_version, status, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    jobId,
    'cemetery',
    cemeteryId,
    'insert',
    JSON.stringify(data),
    0,
    'pending',
    new Date().toISOString(),
    new Date().toISOString()
  );
}