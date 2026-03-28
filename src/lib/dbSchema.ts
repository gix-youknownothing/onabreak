import Database from "@tauri-apps/plugin-sql";

const CREATE_WORKSPACES = `
CREATE TABLE IF NOT EXISTS workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  work_dir TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_pinned INTEGER DEFAULT 0,
  sort_order INTEGER,
  is_completed INTEGER DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  last_active_session_id INTEGER
)`;

const CREATE_SESSIONS = `
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT 'Terminal 1',
  type TEXT NOT NULL DEFAULT 'terminal',
  agent TEXT NOT NULL DEFAULT 'claude',
  provider_id TEXT NOT NULL DEFAULT 'claude-cli',
  provider_config TEXT NOT NULL DEFAULT '{}',
  cli_session_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
)`;

const CREATE_CUSTOM_PROVIDERS = `
CREATE TABLE IF NOT EXISTS custom_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_provider_id TEXT,
  config TEXT NOT NULL,
  sort_order INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`;

const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`;

export async function initDatabaseSchema(db: Database): Promise<void> {
  await db.execute(CREATE_WORKSPACES);
  await db.execute(CREATE_SESSIONS);
  await db.execute(CREATE_CUSTOM_PROVIDERS);
  await db.execute(CREATE_SETTINGS);
}
