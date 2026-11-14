import type { SQLiteDatabase } from 'expo-sqlite';

import type { Burial, BurialSearchResult, BurialStatus, CachedBurial } from '@/types';

import { isFtsAvailable } from './client';

interface BurialRow {
  id: string;
  plot_id: string;
  full_name: string;
  name_normalized: string | null;
  date_of_death: string | null;
  date_of_burial: string | null;
  age_at_death: string | null;
  status: BurialStatus;
  version: number;
  synced_at: string;
}

interface SearchRow {
  burial_id: string;
  plot_id: string;
  full_name: string;
  date_of_death: string | null;
  date_of_burial: string | null;
  plot_identifier: string;
  section_name: string | null;
  cemetery_name: string;
}

function rowToBurial(row: BurialRow): CachedBurial {
  return {
    id: row.id,
    plot_id: row.plot_id,
    full_name: row.full_name,
    name_normalized: row.name_normalized,
    date_of_death: row.date_of_death,
    date_of_burial: row.date_of_burial,
    age_at_death: row.age_at_death,
    status: row.status,
    version: row.version,
    synced_at: row.synced_at,
  };
}

export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const SEARCH_SQL = `
  SELECT
    b.id            AS burial_id,
    b.plot_id       AS plot_id,
    b.full_name     AS full_name,
    b.date_of_death AS date_of_death,
    b.date_of_burial AS date_of_burial,
    p.plot_identifier AS plot_identifier,
    s.name          AS section_name,
    c.name          AS cemetery_name
  FROM burials b
  JOIN plots p     ON p.id = b.plot_id
  JOIN cemeteries c ON c.id = p.cemetery_id
  LEFT JOIN sections s ON s.id = p.section_id
  WHERE b.status = 'verified'
    AND p.cemetery_id = ?
    AND (
      __MATCH__
    )
  ORDER BY b.full_name ASC
  LIMIT ?
`;

export async function searchBurials(
  db: SQLiteDatabase,
  cemeteryId: string,
  query: string,
  limit = 50,
): Promise<BurialSearchResult[]> {
  const normalized = normalizeName(query);
  if (normalized.length === 0) return [];

  if (isFtsAvailable()) {
    const ftsQuery = `${normalized.replace(/["]/g, '""')}*`;
    const sql = SEARCH_SQL.replace(
      '__MATCH__',
      `b.rowid IN (SELECT rowid FROM burial_search WHERE burial_search MATCH ?)`,
    );
    const rows = await db.getAllAsync<SearchRow>(sql, cemeteryId, ftsQuery, limit);
    return rows;
  }

  const likePattern = `%${normalized.replace(/[%_]/g, '\\$&')}%`;
  const sql = SEARCH_SQL.replace(
    '__MATCH__',
    `(b.name_normalized LIKE ? ESCAPE '\\' OR b.full_name LIKE ? ESCAPE '\\')`,
  );
  const rows = await db.getAllAsync<SearchRow>(
    sql,
    cemeteryId,
    likePattern,
    likePattern,
    limit,
  );
  return rows;
}

export async function listBurialsByPlot(
  db: SQLiteDatabase,
  plotId: string,
): Promise<CachedBurial[]> {
  const rows = await db.getAllAsync<BurialRow>(
    'SELECT * FROM burials WHERE plot_id = ? ORDER BY full_name ASC',
    plotId,
  );
  return rows.map(rowToBurial);
}

export async function getBurialById(
  db: SQLiteDatabase,
  id: string,
): Promise<CachedBurial | null> {
  const row = await db.getFirstAsync<BurialRow>('SELECT * FROM burials WHERE id = ?', id);
  return row ? rowToBurial(row) : null;
}

export async function upsertBurial(db: SQLiteDatabase, burial: Burial): Promise<void> {
  const normalized = burial.name_normalized ?? normalizeName(burial.full_name);

  await db.runAsync(
    `INSERT INTO burials (
       id, plot_id, full_name, name_normalized,
       date_of_death, date_of_burial, age_at_death,
       status, version, synced_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       plot_id = excluded.plot_id,
       full_name = excluded.full_name,
       name_normalized = excluded.name_normalized,
       date_of_death = excluded.date_of_death,
       date_of_burial = excluded.date_of_burial,
       age_at_death = excluded.age_at_death,
       status = excluded.status,
       version = excluded.version,
       synced_at = excluded.synced_at
     WHERE excluded.version >= burials.version`,
    burial.id,
    burial.plot_id,
    burial.full_name,
    normalized,
    burial.date_of_death,
    burial.date_of_burial,
    burial.age_at_death,
    burial.status,
    burial.version,
    new Date().toISOString(),
  );
}

export async function deleteBurial(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM burials WHERE id = ?', id);
}

export async function countBurialsByCemetery(
  db: SQLiteDatabase,
  cemeteryId: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM burials b
     JOIN plots p ON p.id = b.plot_id
     WHERE p.cemetery_id = ? AND b.status = 'verified'`,
    cemeteryId,
  );
  return row?.count ?? 0;
}