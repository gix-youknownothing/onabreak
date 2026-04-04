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
  sort_order INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
)`;

const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`;

const CREATE_WORKSPACES_WITHOUT_NOTES = `
CREATE TABLE workspaces_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  work_dir TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_pinned INTEGER DEFAULT 0,
  sort_order INTEGER,
  is_completed INTEGER DEFAULT 0,
  last_active_session_id INTEGER
)`;

async function migrateWorkspacesSchema(db: Database): Promise<void> {
  const workspaceColumns = await db.select<{ name: string }[]>("PRAGMA table_info(workspaces)");
  const hasNotes = workspaceColumns.some((column) => column.name === "notes");
  const hasLastActiveSessionId = workspaceColumns.some(
    (column) => column.name === "last_active_session_id",
  );

  if (!hasNotes && hasLastActiveSessionId) {
    return;
  }

  const lastActiveSelect = hasLastActiveSessionId
    ? "last_active_session_id"
    : "NULL AS last_active_session_id";

  await db.execute("PRAGMA foreign_keys=OFF");
  try {
    await db.execute("BEGIN TRANSACTION");
    await db.execute(CREATE_WORKSPACES_WITHOUT_NOTES);
    await db.execute(
      `INSERT INTO workspaces_new (
        id, name, work_dir, created_at, updated_at, is_pinned, sort_order, is_completed, last_active_session_id
      )
      SELECT
        id,
        name,
        COALESCE(work_dir, ''),
        created_at,
        updated_at,
        COALESCE(is_pinned, 0),
        sort_order,
        COALESCE(is_completed, 0),
        ${lastActiveSelect}
      FROM workspaces`,
    );
    await db.execute("DROP TABLE workspaces");
    await db.execute("ALTER TABLE workspaces_new RENAME TO workspaces");
    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  } finally {
    await db.execute("PRAGMA foreign_keys=ON");
  }
}

export async function initDatabaseSchema(db: Database): Promise<void> {
  await db.execute(CREATE_WORKSPACES);
  await db.execute(CREATE_SESSIONS);
  await db.execute(CREATE_SETTINGS);
  await migrateWorkspacesSchema(db);

  const sessionColumns = await db.select<{ name: string }[]>("PRAGMA table_info(sessions)");
  const hasLegacyCliSessionColumns = sessionColumns.some(
    (column) => column.name === "cli_session_id" || column.name === "cli_session_name",
  );

  if (hasLegacyCliSessionColumns) {
    await db.execute("DROP TABLE sessions");
    await db.execute(CREATE_SESSIONS);
    await db.execute("UPDATE workspaces SET last_active_session_id = NULL");
    return;
  }

  const hasSessionSortOrder = sessionColumns.some((column) => column.name === "sort_order");
  if (!hasSessionSortOrder) {
    await db.execute("ALTER TABLE sessions ADD COLUMN sort_order INTEGER");
  }

  const sessionsMissingSortOrder = await db.select<
    { id: number; workspace_id: number; sort_order: number | null }[]
  >(
    `SELECT id, workspace_id, sort_order
     FROM sessions
     ORDER BY workspace_id ASC, created_at ASC, id ASC`,
  );

  const nextSortOrderByWorkspace = new Map<number, number>();
  for (const session of sessionsMissingSortOrder) {
    const nextSortOrder = nextSortOrderByWorkspace.get(session.workspace_id) ?? 0;
    if (session.sort_order === null) {
      await db.execute("UPDATE sessions SET sort_order = ? WHERE id = ?", [nextSortOrder, session.id]);
      nextSortOrderByWorkspace.set(session.workspace_id, nextSortOrder + 1);
      continue;
    }
    nextSortOrderByWorkspace.set(
      session.workspace_id,
      Math.max(nextSortOrder, session.sort_order + 1),
    );
  }
}
