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
  notes: string;
  last_active_session_id: number | null;
}

export interface Session {
  id: number;
  workspace_id: number;
  name: string;
  provider_id: string;
  provider_config: string;
  cli_session_id: string | null;
  created_at: string;
  updated_at: string;
  type?: string;
  agent?: string;
  notes: string;
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
  clearCliSession: (sessionId: number) => Promise<void>;

  updateWorkspaceNotes: (id: number, notes: string) => Promise<void>;
  updateSessionNotes: (sessionId: number, notes: string) => Promise<void>;

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

  // ─── Workspace CRUD ───

  loadWorkspaces: async () => {
    const { db } = get();
    if (!db) return;

    try {
      const workspaces = await db.select<Workspace[]>(
        `SELECT id, name, work_dir, created_at, updated_at, is_pinned, sort_order, is_completed, COALESCE(notes, '') as notes, last_active_session_id
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

      set({ workspaces, workspaceSessionIds: wsSessionIds });
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
        "INSERT INTO sessions (workspace_id, name, type, agent, provider_id, provider_config) VALUES (?, ?, ?, ?, ?, ?)",
        [wsId, "Session 1", "terminal", defaultProvider.id, defaultProvider.id, "{}"],
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
    set((state) => ({
      currentWorkspace: { ...ws, is_completed: 0 },
      workspaces: state.workspaces.map((w) =>
        w.id === ws.id ? { ...w, is_completed: 0 } : w,
      ),
    }));

    const { db } = get();
    if (db) {
      await db.execute("UPDATE workspaces SET is_completed = 0 WHERE id = ?", [ws.id]);
    }

    await get().loadSessions(ws.id);

    // Restore last active session if it still exists
    const sessions = get().sessions;
    const lastActiveId = ws.last_active_session_id;
    const lastSession = lastActiveId ? sessions.find((s) => s.id === lastActiveId) : null;
    set({ currentSession: lastSession ?? null });

    // Clear unread for the auto-selected session
    if (lastSession) {
      set((state) => {
        const { [lastSession.id]: _c, ...restCounts } = state.unreadSessionCounts;
        return {
          unreadSessionIds: state.unreadSessionIds.filter((id) => id !== lastSession.id),
          unreadSessionCounts: restCounts,
        };
      });
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

      await db.execute("DELETE FROM sessions WHERE workspace_id = ?", [id]);
      await db.execute("DELETE FROM workspaces WHERE id = ?", [id]);

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
      const sessions = await db.select<Session[]>(
        `SELECT id, workspace_id, name, type, agent, provider_id, provider_config, cli_session_id, created_at, updated_at, COALESCE(notes, '') as notes
         FROM sessions WHERE workspace_id = ? ORDER BY created_at ASC`,
        [workspaceId],
      );
      set({ sessions });
    } catch (error) {
      console.error("Failed to load sessions:", error);
    }
  },

  createSession: async (name: string, providerId: string, providerConfig?: Record<string, any>) => {
    const { db, currentWorkspace } = get();
    if (!db || !currentWorkspace) return;

    try {
      const configJson = JSON.stringify(providerConfig || {});
      const result = await db.execute(
        "INSERT INTO sessions (workspace_id, name, type, agent, provider_id, provider_config) VALUES (?, ?, ?, ?, ?, ?)",
        [currentWorkspace.id, name, "terminal", providerId, providerId, configJson],
      );

      await get().loadSessions(currentWorkspace.id);
      await get().loadWorkspaces();

      const newSession = get().sessions.find((s) => s.id === result.lastInsertId);
      if (newSession) {
        set({ currentSession: newSession });
      }
    } catch (error) {
      console.error("Failed to create session:", error);
    }
  },

  selectSession: async (session: Session) => {
    set((state) => {
      const { [session.id]: _c, ...restCounts } = state.unreadSessionCounts;
      return {
        currentSession: session,
        unreadSessionIds: state.unreadSessionIds.filter((id) => id !== session.id),
        unreadSessionCounts: restCounts,
      };
    });
    const { db, currentWorkspace } = get();
    if (db && currentWorkspace) {
      await db.execute(
        "UPDATE workspaces SET last_active_session_id = ? WHERE id = ?",
        [session.id, currentWorkspace.id],
      );
      set((state) => ({
        currentWorkspace: state.currentWorkspace
          ? { ...state.currentWorkspace, last_active_session_id: session.id }
          : null,
        workspaces: state.workspaces.map((ws) =>
          ws.id === currentWorkspace.id
            ? { ...ws, last_active_session_id: session.id }
            : ws,
        ),
      }));
    }
  },

  deleteSession: async (sessionId: number) => {
    const { db, currentSession, currentWorkspace } = get();
    if (!db || !currentWorkspace) return;

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

      await get().loadSessions(currentWorkspace.id);
      await get().loadWorkspaces();

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

    try {
      await db.execute(
        "UPDATE sessions SET name = ?, updated_at = datetime('now') WHERE id = ?",
        [newName.trim(), sessionId],
      );
      if (currentSession?.id === sessionId) {
        set({ currentSession: { ...currentSession, name: newName.trim() } });
      }
      if (currentWorkspace) {
        await get().loadSessions(currentWorkspace.id);
      }
    } catch (error) {
      console.error("Failed to rename session:", error);
    }
  },

  clearCliSession: async (sessionId: number) => {
    const { db, currentSession } = get();
    if (!db) return;

    try {
      await db.execute(
        "UPDATE sessions SET cli_session_id = NULL, updated_at = datetime('now') WHERE id = ?",
        [sessionId],
      );
      if (currentSession?.id === sessionId) {
        set({ currentSession: { ...currentSession, cli_session_id: null } });
      }
      set({
        sessions: get().sessions.map((s) =>
          s.id === sessionId ? { ...s, cli_session_id: null } : s,
        ),
      });
    } catch (error) {
      console.error("Failed to clear CLI session:", error);
    }
  },

  updateWorkspaceNotes: async (id: number, notes: string) => {
    const { db, currentWorkspace } = get();
    if (!db) return;

    try {
      await db.execute(
        "UPDATE workspaces SET notes = ?, updated_at = datetime('now') WHERE id = ?",
        [notes, id],
      );
      if (currentWorkspace?.id === id) {
        set({ currentWorkspace: { ...currentWorkspace, notes } });
      }
      set((state) => ({
        workspaces: state.workspaces.map((ws) =>
          ws.id === id ? { ...ws, notes } : ws,
        ),
      }));
    } catch (error) {
      console.error("Failed to update workspace notes:", error);
    }
  },

  updateSessionNotes: async (sessionId: number, notes: string) => {
    const { db, currentSession } = get();
    if (!db) return;

    try {
      await db.execute(
        "UPDATE sessions SET notes = ?, updated_at = datetime('now') WHERE id = ?",
        [notes, sessionId],
      );
      if (currentSession?.id === sessionId) {
        set({ currentSession: { ...currentSession, notes } });
      }
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? { ...s, notes } : s,
        ),
      }));
    } catch (error) {
      console.error("Failed to update session notes:", error);
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
