import type { SQLiteDatabase } from 'expo-sqlite';

import type { CachedPlot, GeometrySource, Plot, PlotGeometry } from '@/types';

interface PlotRow {
  id: string;
  cemetery_id: string;
  section_id: string | null;
  plot_identifier: string;
  geometry: string;
  bbox_west: number;
  bbox_south: number;
  bbox_east: number;
  bbox_north: number;
  geometry_source: GeometrySource;
  geometry_verified: number;
  version: number;
  synced_at: string;
}

interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

function computeBbox(geometry: PlotGeometry): Bbox {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  const rings =
    geometry.type === 'Polygon'
      ? geometry.coordinates
      : geometry.coordinates.flat();

  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }

  if (!Number.isFinite(west)) {
    throw new Error('Cannot compute bbox of empty geometry');
  }

  return { west, south, east, north };
}

function rowToPlot(row: PlotRow): CachedPlot {
  return {
    id: row.id,
    cemetery_id: row.cemetery_id,
    section_id: row.section_id,
    plot_identifier: row.plot_identifier,
    geometry: JSON.parse(row.geometry) as PlotGeometry,
    geometry_source: row.geometry_source,
    geometry_verified: row.geometry_verified === 1,
    version: row.version,
    synced_at: row.synced_at,
  };
}

export async function listPlotsByCemetery(
  db: SQLiteDatabase,
  cemeteryId: string,
): Promise<CachedPlot[]> {
  const rows = await db.getAllAsync<PlotRow>(
    'SELECT * FROM plots WHERE cemetery_id = ? ORDER BY plot_identifier ASC',
    cemeteryId,
  );
  return rows.map(rowToPlot);
}

export async function listPlotsBySection(
  db: SQLiteDatabase,
  sectionId: string,
): Promise<CachedPlot[]> {
  const rows = await db.getAllAsync<PlotRow>(
    'SELECT * FROM plots WHERE section_id = ? ORDER BY plot_identifier ASC',
    sectionId,
  );
  return rows.map(rowToPlot);
}

export async function listPlotsInBbox(
  db: SQLiteDatabase,
  cemeteryId: string,
  bbox: Bbox,
): Promise<CachedPlot[]> {
  const rows = await db.getAllAsync<PlotRow>(
    `SELECT * FROM plots
     WHERE cemetery_id = ?
       AND bbox_east  >= ?
       AND bbox_west  <= ?
       AND bbox_north >= ?
       AND bbox_south <= ?`,
    cemeteryId,
    bbox.west,
    bbox.east,
    bbox.south,
    bbox.north,
  );
  return rows.map(rowToPlot);
}

export async function getPlotById(
  db: SQLiteDatabase,
  id: string,
): Promise<CachedPlot | null> {
  const row = await db.getFirstAsync<PlotRow>('SELECT * FROM plots WHERE id = ?', id);
  return row ? rowToPlot(row) : null;
}

export async function getPlotByIdentifier(
  db: SQLiteDatabase,
  cemeteryId: string,
  plotIdentifier: string,
): Promise<CachedPlot | null> {
  const row = await db.getFirstAsync<PlotRow>(
    'SELECT * FROM plots WHERE cemetery_id = ? AND plot_identifier = ?',
    cemeteryId,
    plotIdentifier,
  );
  return row ? rowToPlot(row) : null;
}

export async function upsertPlot(db: SQLiteDatabase, plot: Plot): Promise<void> {
  const bbox = computeBbox(plot.geometry);

  await db.runAsync(
    `INSERT INTO plots (
       id, cemetery_id, section_id, plot_identifier, geometry,
       bbox_west, bbox_south, bbox_east, bbox_north,
       geometry_source, geometry_verified, version, synced_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       cemetery_id = excluded.cemetery_id,
       section_id = excluded.section_id,
       plot_identifier = excluded.plot_identifier,
       geometry = excluded.geometry,
       bbox_west = excluded.bbox_west,
       bbox_south = excluded.bbox_south,
       bbox_east = excluded.bbox_east,
       bbox_north = excluded.bbox_north,
       geometry_source = excluded.geometry_source,
       geometry_verified = excluded.geometry_verified,
       version = excluded.version,
       synced_at = excluded.synced_at
     WHERE excluded.version >= plots.version`,
    plot.id,
    plot.cemetery_id,
    plot.section_id,
    plot.plot_identifier,
    JSON.stringify(plot.geometry),
    bbox.west,
    bbox.south,
    bbox.east,
    bbox.north,
    plot.geometry_source,
    plot.geometry_verified ? 1 : 0,
    plot.version,
    new Date().toISOString(),
  );
}

export async function deletePlot(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM plots WHERE id = ?', id);
}

export async function countPlotsByCemetery(
  db: SQLiteDatabase,
  cemeteryId: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM plots WHERE cemetery_id = ?',
    cemeteryId,
  );
  return row?.count ?? 0;
}