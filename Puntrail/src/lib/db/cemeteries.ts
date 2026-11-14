import type { SQLiteDatabase } from 'expo-sqlite';

import type { CachedCemetery, Cemetery, PolygonGeometry } from '@/types';

function rowToCemetery(row: {
  id: string;
  name: string;
  location: string;
  boundary: string | null;
  notes: string | null;
  version: number;
  synced_at: string;
}): CachedCemetery {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    boundary: row.boundary ? (JSON.parse(row.boundary) as PolygonGeometry) : null,
    notes: row.notes,
    version: row.version,
    synced_at: row.synced_at,
  };
}

export async function listCemeteries(db: SQLiteDatabase): Promise<CachedCemetery[]> {
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    location: string;
    boundary: string | null;
    notes: string | null;
    version: number;
    synced_at: string;
  }>('SELECT * FROM cemeteries ORDER BY name ASC');
  return rows.map(rowToCemetery);
}

export async function getCemeteryById(
  db: SQLiteDatabase,
  id: string,
): Promise<CachedCemetery | null> {
  const row = await db.getFirstAsync<{
    id: string;
    name: string;
    location: string;
    boundary: string | null;
    notes: string | null;
    version: number;
    synced_at: string;
  }>('SELECT * FROM cemeteries WHERE id = ?', id);
  return row ? rowToCemetery(row) : null;
}

export async function upsertCemetery(db: SQLiteDatabase, cemetery: Cemetery): Promise<void> {
  await db.runAsync(
    `INSERT INTO cemeteries (id, name, location, boundary, notes, version, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       location = excluded.location,
       boundary = excluded.boundary,
       notes = excluded.notes,
       version = excluded.version,
       synced_at = excluded.synced_at
     WHERE excluded.version >= cemeteries.version`,
    cemetery.id,
    cemetery.name,
    cemetery.location,
    cemetery.boundary ? JSON.stringify(cemetery.boundary) : null,
    cemetery.notes,
    cemetery.version,
    new Date().toISOString(),
  );
}

export async function deleteCemetery(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM cemeteries WHERE id = ?', id);
}

export async function countCemeteries(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM cemeteries',
  );
  return row?.count ?? 0;
}