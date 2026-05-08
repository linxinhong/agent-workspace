import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import * as schema from './schema'

const DB_PATH = '.workspace/app.sqlite'

if (!existsSync(dirname(DB_PATH))) {
  mkdirSync(dirname(DB_PATH), { recursive: true })
}

const sqlite = new Database(DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    skill_id TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL,
    skill_id TEXT,
    model TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    run_id TEXT,
    goal_id TEXT,
    type TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    parent_artifact_id TEXT,
    version INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
  );
`

sqlite.exec(INIT_SQL)

// Migrations for existing databases
const migrations = [
  `ALTER TABLE artifacts ADD COLUMN parent_artifact_id TEXT`,
  `ALTER TABLE artifacts ADD COLUMN version INTEGER DEFAULT 1`,
]

for (const sql of migrations) {
  try { sqlite.exec(sql) } catch { /* column already exists */ }
}
