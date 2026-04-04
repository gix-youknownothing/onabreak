import { create } from "zustand";
import Database from "@tauri-apps/plugin-sql";
import { initDatabaseSchema } from "../lib/dbSchema";

export interface Workspace {
  id: number;
  name: string;
  work_dir: string;
  created_at: string;
  updated_at: string;
  is_pinned: number;
  sort_order: number | null;
  is_completed: number;
  last_active_session_id: number | null;
}

export interface Session {
  id: number;
  workspace_id: number;
  name: string;
  provider_id: string;
  provider_config: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  type?: string;
  agent?: string;
}

export type SessionStatus = "idle" | "streaming" | "exited";

interface ChatState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  workspaceSessionIds: Record<number, number[]>;
  sessions: Session[];
  currentSession: Session | null;
  isLoading: boolean;
  db: Database | null;
  dbStatus: "idle" | "ready" | "error";
  dbError: string | null;
  sessionStatuses: Record<number, SessionStatus>;

  initDatabase: () => Promise<void>;
  clearPersistedSessionsOnLaunch: () => Promise<void>;

  loadWorkspaces: () => Promise<void>;
  createWorkspace: (name: string, workDir: string) => Promise<void>;
  selectWorkspace: (ws: Workspace) => Promise<void>;
  renameWorkspace: (id: number, newName: string) => Promise<void>;
  deleteWorkspace: (id: number) => Promise<void>;
  togglePinWorkspace: (id: number) => Promise<void>;

  loadSessions: (workspaceId: number) => Promise<void>;
  createSession: (name: string, providerId: string, providerConfig?: Record<string, any>) => Promise<void>;
  selectSession: (session: Session) => void;
  deleteSession: (sessionId: number) => Promise<void>;
  renameSession: (sessionId: number, newName: string) => Promise<void>;
  reorderSessions: (orderedSessionIds: number[]) => Promise<void>;

  setSessionStatus: (sessionId: number, status: SessionStatus) => void;

  unreadSessionIds: number[];
  /** Per-session unread marker. Presence means the session has unseen output. */
  unreadSessionCounts: Record<number, number>;
  markSessionUnread: (sessionId: number) => void;
  clearSessionUnread: (sessionId: number) => void;
}

function isTauriRuntime() {
  return (
    typeof window !== "undefined" &&
    (("__TAURI_INTERNALS__" in window) || ("__TAURI__" in window))
  );
}

function filterSessionRecord<T>(
  record: Record<number, T>,
  validSessionIds: Set<number>,
): Record<number, T> {
  const next: Record<number, T> = {};

  for (const [sessionId, value] of Object.entries(record)) {
    const numericSessionId = Number(sessionId);
    if (validSessionIds.has(numericSessionId)) {
      next[numericSessionId] = value;
    }
  }

  return next;
}

function removeSessionsFromRecords<T>(
  record: Record<number, T>,
  removedSessionIds: Set<number>,
): Record<number, T> {
  const next: Record<number, T> = {};

  for (const [sessionId, value] of Object.entries(record)) {
    const numericSessionId = Number(sessionId);
    if (!removedSessionIds.has(numericSessionId)) {
      next[numericSessionId] = value;
    }
  }

  return next;
}

function resolveCurrentSession(
  currentSession: Session | null,
  sessions: Session[],
): Session | null {
  if (!currentSession) return null;
  return sessions.find((session) => session.id === currentSession.id) ?? null;
}

function filterSessionsForWorkspace(
  sessions: Session[],
  workspaceId: number | null,
): Session[] {
  if (workspaceId === null) return [];
  return sessions.filter((session) => session.workspace_id === workspaceId);
}

async function querySessionsForWorkspace(
  db: Database,
  workspaceId: number,
): Promise<Session[]> {
  return db.select<Session[]>(
    `SELECT id, workspace_id, name, type, agent, provider_id, provider_config, sort_order, created_at, updated_at
     FROM sessions
     WHERE workspace_id = ?
     ORDER BY sort_order IS NULL ASC, sort_order ASC, created_at ASC`,
    [workspaceId],
  );
}

async function createDefaultSessionForWorkspace(
  db: Database,
  workspaceId: number,
  sortOrder: number,
): Promise<number> {
  const { providerRegistry } = await import("../lib/providerRegistry");
  const defaultProvider = providerRegistry.getDefault();
  const result = await db.execute(
    "INSERT INTO sessions (workspace_id, name, type, agent, provider_id, provider_config, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [workspaceId, "Session 1", "terminal", defaultProvider.id, defaultProvider.id, "{}", sortOrder],
  );

  if (typeof result.lastInsertId !== "number") {
    throw new Error("Failed to create default session");
  }

  return result.lastInsertId;
}

export const useChatStore = create<ChatState>((set, get) => ({
  workspaces: [],
  currentWorkspace: null,
  workspaceSessionIds: {},
  sessions: [],
  currentSession: null,
  isLoading: false,
  db: null,
  dbStatus: "idle",
  dbError: null,
  sessionStatuses: {},
  unreadSessionIds: [],
  unreadSessionCounts: {},

  initDatabase: async () => {
    if (!isTauriRuntime()) {
      set({
        db: null,
        dbStatus: "error",
        dbError: "当前在浏览器模式运行，Tauri SQLite 插件不可用。请用 `npm run tauri dev` 启动桌面端后再创建会话。",
      });
      return;
    }

    try {
      const db = await Database.load("sqlite:onabreak.db");
      await initDatabaseSchema(db);

      set({ db, dbStatus: "ready", dbError: null });
    } catch (error) {
      console.error("Failed to init database:", error);
      set({
        db: null,
        dbStatus: "error",
        dbError: "初始化本地数据库失败。请确认已用 `npm run tauri dev` 启动，并且系统依赖齐全。",
      });
    }
  },

  clearPersistedSessionsOnLaunch: async () => {
    const { db } = get();
    if (!db) return;

    try {
      await db.execute("DELETE FROM sessions");
      await db.execute("UPDATE workspaces SET last_active_session_id = NULL");

      set((state) => ({
        sessions: [],
        currentSession: null,
        workspaceSessionIds: Object.fromEntries(
          state.workspaces.map((workspace) => [workspace.id, []]),
        ),
        workspaces: state.workspaces.map((workspace) => ({
          ...workspace,
          last_active_session_id: null,
        })),
        currentWorkspace: state.currentWorkspace
          ? { ...state.currentWorkspace, last_active_session_id: null }
          : null,
        unreadSessionIds: [],
        unreadSessionCounts: {},
        sessionStatuses: {},
      }));
    } catch (error) {
      console.error("Failed to clear persisted sessions on launch:", error);
    }
  },

  // ─── Workspace CRUD ───

  loadWorkspaces: async () => {
    const { db } = get();
    if (!db) return;

    try {
      const workspaces = await db.select<Workspace[]>(
        `SELECT id, name, work_dir, created_at, updated_at, is_pinned, sort_order, is_completed, last_active_session_id
         FROM workspaces
         ORDER BY is_pinned DESC, sort_order ASC NULLS LAST, updated_at DESC`,
      );

      const allSessions = await db.select<{ id: number; workspace_id: number }[]>(
        "SELECT id, workspace_id FROM sessions",
      );

      const wsSessionIds: Record<number, number[]> = {};
      for (const s of allSessions) {
        if (!wsSessionIds[s.workspace_id]) wsSessionIds[s.workspace_id] = [];
        wsSessionIds[s.workspace_id].push(s.id);
      }

      const validSessionIds = new Set(allSessions.map((session) => session.id));
      const currentWorkspaceId = get().currentWorkspace?.id ?? null;
      const currentWorkspaceSessions = filterSessionsForWorkspace(
        get().sessions.filter((session) => validSessionIds.has(session.id)),
        currentWorkspaceId,
      );

      set((state) => ({
        currentWorkspace: state.currentWorkspace
          ? workspaces.find((workspace) => workspace.id === state.currentWorkspace?.id) ?? null
          : null,
        sessions: currentWorkspaceSessions,
        currentSession: resolveCurrentSession(
          state.currentSession &&
            validSessionIds.has(state.currentSession.id) &&
            (!state.currentWorkspace || state.currentSession.workspace_id === state.currentWorkspace.id)
              ? state.currentSession
              : null,
          currentWorkspaceSessions,
        ) ?? currentWorkspaceSessions[0] ?? null,
        workspaces,
        workspaceSessionIds: wsSessionIds,
        unreadSessionIds: state.unreadSessionIds.filter((id) => validSessionIds.has(id)),
        unreadSessionCounts: filterSessionRecord(
          state.unreadSessionCounts,
          validSessionIds,
        ),
        sessionStatuses: filterSessionRecord(state.sessionStatuses, validSessionIds),
      }));
    } catch (error) {
      console.error("Failed to load workspaces:", error);
    }
  },

  createWorkspace: async (name: string, workDir: string) => {
    const { db } = get();
    if (!db) return;

    try {
      const wsResult = await db.execute(
        "INSERT INTO workspaces (name, work_dir) VALUES (?, ?)",
        [name, workDir],
      );
      const wsId = wsResult.lastInsertId;

      const { providerRegistry } = await import("../lib/providerRegistry");
      const defaultProvider = providerRegistry.getDefault();
      await db.execute(
        "INSERT INTO sessions (workspace_id, name, type, agent, provider_id, provider_config, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [wsId, "Session 1", "terminal", defaultProvider.id, defaultProvider.id, "{}", 0],
      );

      await get().loadWorkspaces();

      const ws = get().workspaces.find((w) => w.id === wsId);
      if (ws) {
        await get().selectWorkspace(ws);
      }
    } catch (error) {
      console.error("Failed to create workspace:", error);
    }
  },

  selectWorkspace: async (ws: Workspace) => {
    const previousState = {
      currentWorkspace: get().currentWorkspace,
      currentSession: get().currentSession,
      sessions: get().sessions,
    };
    const previousWorkspaceId = get().currentWorkspace?.id ?? null;
    const isWorkspaceSwitch = previousWorkspaceId !== ws.id;

    set((state) => ({
      currentWorkspace: { ...ws, is_completed: 0 },
      workspaces: state.workspaces.map((w) =>
        w.id === ws.id ? { ...w, is_completed: 0 } : w,
      ),
      ...(isWorkspaceSwitch
        ? {
            currentSession: null,
          }
        : {}),
    }));

    const { db } = get();
    if (db) {
      try {
        await db.execute("UPDATE workspaces SET is_completed = 0 WHERE id = ?", [ws.id]);
      } catch (error) {
        console.error("Failed to mark workspace active:", error);
      }
    }

    try {
      const sessions = db ? await querySessionsForWorkspace(db, ws.id) : [];

      if (get().currentWorkspace?.id !== ws.id) {
        return;
      }

      if (db && sessions.length === 0) {
        await createDefaultSessionForWorkspace(db, ws.id, 0);
        const refreshedSessions = await querySessionsForWorkspace(db, ws.id);

        if (get().currentWorkspace?.id !== ws.id) {
          return;
        }

        set({
          sessions: refreshedSessions,
          currentSession: refreshedSessions[0] ?? null,
        });
        await get().loadWorkspaces();
        return;
      }

      const lastActiveId = ws.last_active_session_id;
      const selectedSession =
        (lastActiveId ? sessions.find((s) => s.id === lastActiveId) : null) ?? sessions[0] ?? null;

      set((state) => {
        const { [selectedSession?.id ?? -1]: _c, ...restCounts } = state.unreadSessionCounts;
        return {
          sessions,
          currentSession: selectedSession,
          unreadSessionIds: selectedSession
            ? state.unreadSessionIds.filter((id) => id !== selectedSession.id)
            : state.unreadSessionIds,
          unreadSessionCounts: selectedSession ? restCounts : state.unreadSessionCounts,
        };
      });

      if (db && selectedSession && selectedSession.id !== lastActiveId) {
        await db.execute(
          "UPDATE workspaces SET last_active_session_id = ? WHERE id = ?",
          [selectedSession.id, ws.id],
        );
        set((state) => ({
          currentWorkspace:
            state.currentWorkspace?.id === ws.id
              ? { ...state.currentWorkspace, last_active_session_id: selectedSession.id }
              : state.currentWorkspace,
          workspaces: state.workspaces.map((workspace) =>
            workspace.id === ws.id
              ? { ...workspace, last_active_session_id: selectedSession.id }
              : workspace,
          ),
        }));
      }
    } catch (error) {
      console.error("Failed to select workspace:", error);
      set(previousState);
    }
  },

  renameWorkspace: async (id: number, newName: string) => {
    const { db, currentWorkspace } = get();
    if (!db || !newName.trim()) return;

    try {
      await db.execute(
        "UPDATE workspaces SET name = ?, updated_at = datetime('now') WHERE id = ?",
        [newName.trim(), id],
      );
      if (currentWorkspace?.id === id) {
        set({ currentWorkspace: { ...currentWorkspace, name: newName.trim() } });
      }
      await get().loadWorkspaces();
    } catch (error) {
      console.error("Failed to rename workspace:", error);
    }
  },

  deleteWorkspace: async (id: number) => {
    const { db, currentWorkspace } = get();
    if (!db) return;

    try {
      const wsSessions = await db.select<Session[]>(
        "SELECT id FROM sessions WHERE workspace_id = ?",
        [id],
      );

      const [{ killPtySession }, { disposeTerminalSession }] = await Promise.all([
        import("../lib/ptyManager"),
        import("../lib/terminalSessionCache"),
      ]);
      for (const s of wsSessions) {
        killPtySession(s.id);
        disposeTerminalSession(s.id);
      }

      const removedSessionIds = new Set(wsSessions.map((session) => session.id));

      await db.execute("DELETE FROM sessions WHERE workspace_id = ?", [id]);
      await db.execute("DELETE FROM workspaces WHERE id = ?", [id]);

      set((state) => ({
        unreadSessionIds: state.unreadSessionIds.filter(
          (sessionId) => !removedSessionIds.has(sessionId),
        ),
        unreadSessionCounts: removeSessionsFromRecords(
          state.unreadSessionCounts,
          removedSessionIds,
        ),
        sessionStatuses: removeSessionsFromRecords(
          state.sessionStatuses,
          removedSessionIds,
        ),
      }));

      if (currentWorkspace?.id === id) {
        set({ currentWorkspace: null, currentSession: null, sessions: [] });
      }
      await get().loadWorkspaces();
    } catch (error) {
      console.error("Failed to delete workspace:", error);
    }
  },

  togglePinWorkspace: async (id: number) => {
    const { db, workspaces } = get();
    if (!db) return;

    const ws = workspaces.find((w) => w.id === id);
    if (!ws) return;
    const newPinned = ws.is_pinned === 1 ? 0 : 1;

    try {
      await db.execute("UPDATE workspaces SET is_pinned = ? WHERE id = ?", [newPinned, id]);
      await get().loadWorkspaces();
    } catch (error) {
      console.error("Failed to toggle pin:", error);
    }
  },

  // ─── Session CRUD (tabs within current workspace) ───

  loadSessions: async (workspaceId: number) => {
    const { db } = get();
    if (!db) return;

    try {
      const sessions = await querySessionsForWorkspace(db, workspaceId);
      set((state) => {
        if (state.currentWorkspace?.id !== workspaceId) {
          return {};
        }

        return {
          sessions,
          currentSession: resolveCurrentSession(state.currentSession, sessions) ?? sessions[0] ?? null,
        };
      });
    } catch (error) {
      console.error("Failed to load sessions:", error);
    }
  },

  createSession: async (name: string, providerId: string, providerConfig?: Record<string, any>) => {
    const { db, currentWorkspace, sessions } = get();
    if (!db || !currentWorkspace) return;
    const workspaceId = currentWorkspace.id;

    try {
      const configJson = JSON.stringify(providerConfig || {});
      const nextSortOrder = sessions.reduce((maxOrder, session) => {
        if (session.sort_order === null) return maxOrder;
        return Math.max(maxOrder, session.sort_order);
      }, -1) + 1;
      const result = await db.execute(
        "INSERT INTO sessions (workspace_id, name, type, agent, provider_id, provider_config, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [workspaceId, name, "terminal", providerId, providerId, configJson, nextSortOrder],
      );

      await get().loadSessions(workspaceId);
      await get().loadWorkspaces();

      if (get().currentWorkspace?.id !== workspaceId) {
        return;
      }

      const newSession = get().sessions.find((s) => s.id === result.lastInsertId);
      if (newSession) {
        set({ currentSession: newSession });
      }
    } catch (error) {
      console.error("Failed to create session:", error);
    }
  },

  selectSession: async (session: Session) => {
    const { currentWorkspace: activeWorkspace } = get();
    if (activeWorkspace && session.workspace_id !== activeWorkspace.id) {
      return;
    }
    const workspaceId = session.workspace_id;

    set((state) => {
      const { [session.id]: _c, ...restCounts } = state.unreadSessionCounts;
      return {
        currentSession: session,
        unreadSessionIds: state.unreadSessionIds.filter((id) => id !== session.id),
        unreadSessionCounts: restCounts,
      };
    });
    const { db } = get();
    if (db) {
      await db.execute(
        "UPDATE workspaces SET last_active_session_id = ? WHERE id = ?",
        [session.id, workspaceId],
      );
      set((state) => ({
        currentWorkspace:
          state.currentWorkspace?.id === workspaceId
            ? { ...state.currentWorkspace, last_active_session_id: session.id }
            : state.currentWorkspace,
        workspaces: state.workspaces.map((ws) =>
          ws.id === workspaceId
            ? { ...ws, last_active_session_id: session.id }
            : ws,
        ),
      }));
    }
  },

  deleteSession: async (sessionId: number) => {
    const { db, currentSession, currentWorkspace } = get();
    if (!db || !currentWorkspace) return;
    const workspaceId = currentWorkspace.id;

    try {
      const [{ killPtySession }, { disposeTerminalSession }] = await Promise.all([
        import("../lib/ptyManager"),
        import("../lib/terminalSessionCache"),
      ]);
      killPtySession(sessionId);
      disposeTerminalSession(sessionId);

      await db.execute("DELETE FROM sessions WHERE id = ?", [sessionId]);

      const wasActive = currentSession?.id === sessionId;
      if (wasActive) {
        set({ currentSession: null });
      }

      set((state) => {
        const { [sessionId]: _c, ...restCounts } = state.unreadSessionCounts;
        return {
          unreadSessionIds: state.unreadSessionIds.filter((id) => id !== sessionId),
          unreadSessionCounts: restCounts,
        };
      });

      await get().loadSessions(workspaceId);
      await get().loadWorkspaces();

      if (get().currentWorkspace?.id !== workspaceId) {
        return;
      }

      if (wasActive) {
        const sessions = get().sessions;
        set({ currentSession: sessions.length > 0 ? sessions[0] : null });
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  },

  renameSession: async (sessionId: number, newName: string) => {
    const { db, currentSession, currentWorkspace } = get();
    if (!db || !newName.trim()) return;
    const workspaceId = currentWorkspace?.id ?? null;

    try {
      await db.execute(
        "UPDATE sessions SET name = ?, updated_at = datetime('now') WHERE id = ?",
        [newName.trim(), sessionId],
      );
      if (currentSession?.id === sessionId) {
        set({ currentSession: { ...currentSession, name: newName.trim() } });
      }
      if (workspaceId !== null) {
        await get().loadSessions(workspaceId);
      }
    } catch (error) {
      console.error("Failed to rename session:", error);
    }
  },

  reorderSessions: async (orderedSessionIds: number[]) => {
    const { db, currentWorkspace, sessions, currentSession } = get();
    if (!db || !currentWorkspace || orderedSessionIds.length !== sessions.length) return;
    const workspaceId = currentWorkspace.id;

    const sessionIdSet = new Set(sessions.map((session) => session.id));
    if (orderedSessionIds.some((sessionId) => !sessionIdSet.has(sessionId))) return;

    const reorderedSessions: Session[] = [];
    for (const [index, sessionId] of orderedSessionIds.entries()) {
      const session = sessions.find((entry) => entry.id === sessionId);
      if (session) {
        reorderedSessions.push({ ...session, sort_order: index });
      }
    }

    set({
      sessions: reorderedSessions,
      currentSession: currentSession
        ? reorderedSessions.find((session) => session.id === currentSession.id) ?? null
        : null,
    });

    try {
      await Promise.all(
        orderedSessionIds.map((sessionId, index) =>
          db.execute(
            "UPDATE sessions SET sort_order = ?, updated_at = datetime('now') WHERE id = ? AND workspace_id = ?",
            [index, sessionId, workspaceId],
          ),
        ),
      );
    } catch (error) {
      console.error("Failed to reorder sessions:", error);
      await get().loadSessions(workspaceId);
    }
  },

  setSessionStatus: (sessionId: number, status: SessionStatus) => {
    set((state) => ({
      sessionStatuses: { ...state.sessionStatuses, [sessionId]: status },
    }));
  },

  markSessionUnread: (sessionId: number) => {
    set((state) => {
      if (state.unreadSessionIds.includes(sessionId)) {
        return state;
      }

      return {
        unreadSessionIds: [...state.unreadSessionIds, sessionId],
        unreadSessionCounts: { ...state.unreadSessionCounts, [sessionId]: 1 },
      };
    });
  },

  clearSessionUnread: (sessionId: number) => {
    set((state) => {
      const { [sessionId]: _c, ...restCounts } = state.unreadSessionCounts;
      return {
        unreadSessionIds: state.unreadSessionIds.filter((id) => id !== sessionId),
        unreadSessionCounts: restCounts,
      };
    });
  },
}));
