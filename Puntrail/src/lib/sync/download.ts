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

export async function downloadCemeteryData(): Promise<void> {
  const db = await getDb();

  // 1. Fetch Cemeteries
  const { data: cemeteries, error: cemError } = await supabase
    .from('cemeteries')
    .select('*');

  if (cemError) throw new Error(`Failed to fetch cemeteries: ${cemError.message}`);
  if (!cemeteries) return;

  for (const row of cemeteries) {
    const cemetery: Cemetery = {
      id: row.id,
      name: row.name,
      location: row.location,
      boundary: null, // Skipping boundary for now to keep download simple
      notes: row.notes,
      version: row.version,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
    await upsertCemetery(db, cemetery);
  }

  // 2. Fetch Sections
  const { data: sections, error: secError } = await supabase
    .from('sections')
    .select('*');
  
  if (!secError && sections) {
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
  }

  // 3. Fetch Plots (using PostGIS ST_AsGeoJSON)
  const { data: plots, error: plotError } = await supabase
    .rpc('get_plots_as_geojson'); // We will create this RPC below

  if (plotError) throw new Error(`Failed to fetch plots: ${plotError.message}`);
  if (plots) {
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
  }

  // 4. Fetch Burials
  const { data: burials, error: burialError } = await supabase
    .from('burials')
    .select('*');

  if (burialError) throw new Error(`Failed to fetch burials: ${burialError.message}`);
  if (burials) {
    for (const row of burials) {
      const burial: Burial = {
        id: row.id,
        plot_id: row.plot_id,
        full_name: row.full_name,
        name_normalized: row.name_normalized,
        date_of_death: row.date_of_death,
        date_of_burial: row.date_of_burial,
        age_at_death: row.age_at_death,
        notes: row.notes,
        status: row.status,
        version: row.version,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
      await upsertBurial(db, burial);
    }
  }
}