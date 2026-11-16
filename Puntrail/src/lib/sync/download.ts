import { supabase } from '@/lib/supabase';
import type { Cemetery, Plot, Burial, Section } from '@/types';
import {
  upsertCemetery,
  upsertPlot,
  upsertBurial,
  upsertSection,
  getDb,
} from '@/lib/db';

interface SupabasePlotRow {
  id: string;
  cemetery_id: string;
  section_id: string | null;
  plot_identifier: string;
  geom_geojson: string;
  geometry_source: 'survey' | 'official_plan' | 'imagery' | 'estimated';
  geometry_verified: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

async function deleteMissingLocal(
  db: Awaited<ReturnType<typeof getDb>>,
  table: 'cemeteries' | 'sections' | 'plots' | 'burials',
  entityType: 'cemetery' | 'section' | 'plot' | 'burial',
  remoteIds: string[],
) {
  // Find IDs that are queued locally — do NOT delete those.
  const queued = await db.getAllAsync<{ entity_id: string }>(
    `SELECT DISTINCT entity_id FROM sync_queue WHERE entity_type = ? AND status IN ('pending', 'in_progress', 'failed')`,
    entityType,
  );
  const protectedIds = new Set(queued.map((r) => r.entity_id));

  // Filter out remote IDs to find local rows to delete
  const local = await db.getAllAsync<{ id: string }>(`SELECT id FROM ${table}`);
  const toDelete = local
    .map((r) => r.id)
    .filter((id) => !remoteIds.includes(id) && !protectedIds.has(id));

  if (toDelete.length === 0) return;

  const placeholders = toDelete.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM ${table} WHERE id IN (${placeholders})`, ...toDelete);
}

export async function downloadCemeteryData(): Promise<void> {
  const db = await getDb();

  // ── 1. Cemeteries ──
  const { data: cemeteries, error: cemError } = await supabase
    .from('cemeteries')
    .select('*');

  if (cemError) throw new Error(`Failed to fetch cemeteries: ${cemError.message}`);

  if (cemeteries) {
    const remoteIds = cemeteries.map((r) => r.id);

    for (const row of cemeteries) {
      const cemetery: Cemetery = {
        id: row.id,
        name: row.name,
        location: row.location,
        boundary: null,
        notes: row.notes,
        version: row.version,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
      await upsertCemetery(db, cemetery);
    }

    await deleteMissingLocal(db, 'cemeteries', 'cemetery', remoteIds);
  }

  // ── 2. Sections ──
  const { data: sections, error: secError } = await supabase
    .from('sections')
    .select('*');

  if (!secError && sections) {
    const remoteIds = sections.map((r) => r.id);

    for (const row of sections) {
      const section: Section = {
        id: row.id,
        cemetery_id: row.cemetery_id,
        name: row.name,
        boundary: null,
        version: row.version,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
      await upsertSection(db, section);
    }

    await deleteMissingLocal(db, 'sections', 'section', remoteIds);
  }

  // ── 3. Plots ──
  const { data: plots, error: plotError } = await supabase
    .rpc('get_plots_as_geojson');

  if (plotError) throw new Error(`Failed to fetch plots: ${plotError.message}`);

  if (plots) {
    const remoteIds = (plots as SupabasePlotRow[]).map((r) => r.id);

    for (const row of plots as SupabasePlotRow[]) {
      const plot: Plot = {
        id: row.id,
        cemetery_id: row.cemetery_id,
        section_id: row.section_id,
        plot_identifier: row.plot_identifier,
        geometry: JSON.parse(row.geom_geojson),
        geometry_source: row.geometry_source,
        geometry_verified: row.geometry_verified,
        version: row.version,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
      await upsertPlot(db, plot);
    }

    await deleteMissingLocal(db, 'plots', 'plot', remoteIds);
  }

  // ── 4. Burials ──
  const { data: burials, error: burialError } = await supabase
    .from('burials')
    .select('*');

  if (burialError) throw new Error(`Failed to fetch burials: ${burialError.message}`);

  if (burials) {
    const remoteIds = burials.map((r) => r.id);

    for (const row of burials) {
      const burial: Burial = {
        id: row.id,
        plot_id: row.plot_id,
        full_name: row.full_name,
        name_normalized: row.name_normalized,
        date_of_death: row.date_of_death,
        date_of_burial: row.date_of_burial,
        age_at_death: row.age_at_death,
        status: row.status,
        version: row.version,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
      await upsertBurial(db, burial);
    }

    await deleteMissingLocal(db, 'burials', 'burial', remoteIds);
  }
}