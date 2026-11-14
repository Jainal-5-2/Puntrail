import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_NAME, migrateDbIfNeeded, createSearchIndex, hasFts5 } from './schema';

let dbInstance: SQLiteDatabase | null = null;
let ftsAvailable = false;

export async function getDb(): Promise<SQLiteDatabase> {
  if (dbInstance) return dbInstance;

  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');

  await migrateDbIfNeeded(db);

  ftsAvailable = await hasFts5(db);
  if (ftsAvailable) {
    await createSearchIndex(db);
  }

  dbInstance = db;
  return db;
}

export function isFtsAvailable(): boolean {
  return ftsAvailable;
}

export async function closeDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
    ftsAvailable = false;
  }
}