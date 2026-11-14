import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'puntrail.db';
export const DATABASE_VERSION = 1;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) return;

  if (currentVersion === 0) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cemeteries (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        boundary TEXT,
        notes TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        synced_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sections (
        id TEXT PRIMARY KEY NOT NULL,
        cemetery_id TEXT NOT NULL REFERENCES cemeteries(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        boundary TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        synced_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sections_cemetery ON sections(cemetery_id);

      CREATE TABLE IF NOT EXISTS plots (
        id TEXT PRIMARY KEY NOT NULL,
        cemetery_id TEXT NOT NULL REFERENCES cemeteries(id) ON DELETE CASCADE,
        section_id TEXT REFERENCES sections(id) ON DELETE SET NULL,
        plot_identifier TEXT NOT NULL,
        geometry TEXT NOT NULL,
        bbox_west REAL NOT NULL,
        bbox_south REAL NOT NULL,
        bbox_east REAL NOT NULL,
        bbox_north REAL NOT NULL,
        geometry_source TEXT NOT NULL,
        geometry_verified INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        synced_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_plots_cemetery ON plots(cemetery_id);
      CREATE INDEX IF NOT EXISTS idx_plots_section ON plots(section_id);
      CREATE INDEX IF NOT EXISTS idx_plots_bbox ON plots(bbox_west, bbox_south, bbox_east, bbox_north);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_plots_identifier ON plots(cemetery_id, plot_identifier);

      CREATE TABLE IF NOT EXISTS burials (
        id TEXT PRIMARY KEY NOT NULL,
        plot_id TEXT NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
        full_name TEXT NOT NULL,
        name_normalized TEXT,
        date_of_death TEXT,
        date_of_burial TEXT,
        age_at_death TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        version INTEGER NOT NULL DEFAULT 1,
        synced_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_burials_plot ON burials(plot_id);
      CREATE INDEX IF NOT EXISTS idx_burials_status ON burials(status);
      CREATE INDEX IF NOT EXISTS idx_burials_name ON burials(name_normalized);

      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        base_version INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id);

      CREATE TABLE IF NOT EXISTS offline_map_packs (
        id TEXT PRIMARY KEY NOT NULL,
        cemetery_id TEXT NOT NULL,
        label TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        bbox_west REAL NOT NULL,
        bbox_south REAL NOT NULL,
        bbox_east REAL NOT NULL,
        bbox_north REAL NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_offline_packs_cemetery ON offline_map_packs(cemetery_id);
    `);

    await db.execAsync('PRAGMA user_version = 1');
  }
}

export async function createSearchIndex(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE VIRTUAL TABLE IF NOT EXISTS burial_search USING fts5(
      full_name,
      name_normalized,
      content='burials',
      content_rowid='rowid',
      tokenize='unicode61 remove_diacritics 2'
    );

    CREATE TRIGGER IF NOT EXISTS burials_ai AFTER INSERT ON burials BEGIN
      INSERT INTO burial_search(rowid, full_name, name_normalized)
      VALUES (new.rowid, new.full_name, new.name_normalized);
    END;

    CREATE TRIGGER IF NOT EXISTS burials_ad AFTER DELETE ON burials BEGIN
      INSERT INTO burial_search(burial_search, rowid, full_name, name_normalized)
      VALUES ('delete', old.rowid, old.full_name, old.name_normalized);
    END;

    CREATE TRIGGER IF NOT EXISTS burials_au AFTER UPDATE ON burials BEGIN
      INSERT INTO burial_search(burial_search, rowid, full_name, name_normalized)
      VALUES ('delete', old.rowid, old.full_name, old.name_normalized);
      INSERT INTO burial_search(rowid, full_name, name_normalized)
      VALUES (new.rowid, new.full_name, new.name_normalized);
    END;
  `);
}

export async function hasFts5(db: SQLiteDatabase): Promise<boolean> {
  try {
    await db.execAsync('CREATE VIRTUAL TABLE IF NOT EXISTS __fts5_probe USING fts5(x)');
    await db.execAsync('DROP TABLE IF EXISTS __fts5_probe');
    return true;
  } catch {
    return false;
  }
}