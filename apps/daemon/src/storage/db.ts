import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import * as schema from './schema'

export const DEFAULT_PROJECT_ID = 'default'

const DB_PATH = '.workspace/app.sqlite'

if (!existsSync(dirname(DB_PATH))) {
  mkdirSync(dirname(DB_PATH), { recursive: true })
}

const sqlite = new Database(DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    skill_id TEXT,
    project_id TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL,
    skill_id TEXT,
    model TEXT,
    status TEXT NOT NULL,
    project_id TEXT,
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
    project_id TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER NOT NULL,
    content_text TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`

sqlite.exec(INIT_SQL)

// Migrations for existing databases
const migrations = [
  `ALTER TABLE artifacts ADD COLUMN parent_artifact_id TEXT`,
  `ALTER TABLE artifacts ADD COLUMN version INTEGER DEFAULT 1`,
  `ALTER TABLE goals ADD COLUMN project_id TEXT`,
  `ALTER TABLE runs ADD COLUMN project_id TEXT`,
  `ALTER TABLE artifacts ADD COLUMN project_id TEXT`,
  `ALTER TABLE artifacts ADD COLUMN change_note TEXT`,
  `ALTER TABLE runs ADD COLUMN agent_id TEXT`,
  `ALTER TABLE runs ADD COLUMN agent_kind TEXT`,
  `ALTER TABLE runs ADD COLUMN command TEXT`,
  `ALTER TABLE runs ADD COLUMN cwd TEXT`,
  `ALTER TABLE runs ADD COLUMN exit_code INTEGER`,
  `ALTER TABLE runs ADD COLUMN duration_ms INTEGER`,
  `ALTER TABLE runs ADD COLUMN stdout_path TEXT`,
  `ALTER TABLE runs ADD COLUMN stderr_path TEXT`,
  `ALTER TABLE runs ADD COLUMN result_path TEXT`,
  `ALTER TABLE runs ADD COLUMN timed_out INTEGER DEFAULT 0`,
  `ALTER TABLE runs ADD COLUMN cancelled INTEGER DEFAULT 0`,
]

for (const sql of migrations) {
  try { sqlite.exec(sql) } catch { /* column already exists */ }
}

// Ensure default project exists
const now = new Date().toISOString()
const insertDefault = sqlite.prepare(
  `INSERT OR IGNORE INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
)
insertDefault.run(DEFAULT_PROJECT_ID, 'Default Project', 'Default workspace for artifacts', now, now)
