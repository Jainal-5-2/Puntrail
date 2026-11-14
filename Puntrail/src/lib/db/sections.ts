import type { SQLiteDatabase } from 'expo-sqlite';

import type { CachedSection, PolygonGeometry, Section } from '@/types';

interface SectionRow {
  id: string;
  cemetery_id: string;
  name: string;
  boundary: string | null;
  version: number;
  synced_at: string;
}

function rowToSection(row: SectionRow): CachedSection {
  return {
    id: row.id,
    cemetery_id: row.cemetery_id,
    name: row.name,
    boundary: row.boundary ? (JSON.parse(row.boundary) as PolygonGeometry) : null,
    version: row.version,
    synced_at: row.synced_at,
  };
}

export async function listSectionsByCemetery(
  db: SQLiteDatabase,
  cemeteryId: string,
): Promise<CachedSection[]> {
  const rows = await db.getAllAsync<SectionRow>(
    'SELECT * FROM sections WHERE cemetery_id = ? ORDER BY name ASC',
    cemeteryId,
  );
  return rows.map(rowToSection);
}

export async function getSectionById(
  db: SQLiteDatabase,
  id: string,
): Promise<CachedSection | null> {
  const row = await db.getFirstAsync<SectionRow>('SELECT * FROM sections WHERE id = ?', id);
  return row ? rowToSection(row) : null;
}

export async function upsertSection(db: SQLiteDatabase, section: Section): Promise<void> {
  await db.runAsync(
    `INSERT INTO sections (id, cemetery_id, name, boundary, version, synced_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       cemetery_id = excluded.cemetery_id,
       name = excluded.name,
       boundary = excluded.boundary,
       version = excluded.version,
       synced_at = excluded.synced_at
     WHERE excluded.version >= sections.version`,
    section.id,
    section.cemetery_id,
    section.name,
    section.boundary ? JSON.stringify(section.boundary) : null,
    section.version,
    new Date().toISOString(),
  );
}

export async function deleteSection(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM sections WHERE id = ?', id);
}

export async function countSectionsByCemetery(
  db: SQLiteDatabase,
  cemeteryId: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM sections WHERE cemetery_id = ?',
    cemeteryId,
  );
  return row?.count ?? 0;
}