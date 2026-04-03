import { spawn, type IPty } from "tauri-pty";
import { useChatStore } from "../stores/chatStore";

export interface PtySession {
  pty: IPty;
  sessionId: number;
}

const sessions = new Map<number, PtySession>();

// --- Session status tracking ---

const streamingTimers = new Map<number, ReturnType<typeof setTimeout>>();
const userInitiated = new Set<number>();
const IDLE_TIMEOUT_MS = 3000;

function resetIdleTimer(sessionId: number) {
  const prev = streamingTimers.get(sessionId);
  if (prev) clearTimeout(prev);

  streamingTimers.set(
    sessionId,
    setTimeout(() => {
      streamingTimers.delete(sessionId);
      const store = useChatStore.getState();
      store.setSessionStatus(sessionId, "idle");
      userInitiated.delete(sessionId);
      // Mark unread when output pauses
      const { currentSession } = store;
      if (currentSession?.id !== sessionId) {
        store.markSessionUnread(sessionId);
      }
    }, IDLE_TIMEOUT_MS)
  );
}

/**
 * Called when user explicitly sends input (ChatInput send, or Enter in terminal).
 * This is the ONLY way to enter "streaming" state.
 */
export function notifyUserInput(sessionId: number) {
  userInitiated.add(sessionId);
  useChatStore.getState().setSessionStatus(sessionId, "streaming");
  resetIdleTimer(sessionId);
}

/**
 * Called on every PTY data chunk. Only extends an existing streaming phase
 * (resets the idle timer). Does NOT initiate streaming on its own.
 */
export function notifyPtyData(sessionId: number) {
  const store = useChatStore.getState();
  const status = store.sessionStatuses[sessionId];
  if (status === "streaming") {
    resetIdleTimer(sessionId);
  }
}

/**
 * Called when the PTY process exits.
 */
export function notifyPtyExit(sessionId: number) {
  const prev = streamingTimers.get(sessionId);
  if (prev) {
    clearTimeout(prev);
    streamingTimers.delete(sessionId);
  }
  userInitiated.delete(sessionId);
  const store = useChatStore.getState();
  store.setSessionStatus(sessionId, "exited");
  // Mark unread only when the agent process actually exits
  const { currentSession } = store;
  if (currentSession?.id !== sessionId) {
    store.markSessionUnread(sessionId);
  }
}

export function spawnPty(
  sessionId: number,
  command: { file: string; args: string[] },
  options: { cols: number; rows: number; cwd?: string },
): IPty {
  const pty = spawn(command.file, command.args, options);
  sessions.set(sessionId, { pty, sessionId });
  return pty;
}

export function writeToPty(sessionId: number, data: string) {
  const s = sessions.get(sessionId);
  if (s) s.pty.write(data);
}

export function getPtyPid(sessionId: number): number | null {
  const s = sessions.get(sessionId);
  return s ? s.pty.pid : null;
}

export function killPtySession(sessionId: number) {
  const prevTimer = streamingTimers.get(sessionId);
  if (prevTimer) {
    clearTimeout(prevTimer);
    streamingTimers.delete(sessionId);
  }
  userInitiated.delete(sessionId);

  const s = sessions.get(sessionId);
  if (s) {
    try {
      s.pty.kill();
    } catch {
      /* already dead */
    }
    sessions.delete(sessionId);
  }
}

export function hasPtySession(sessionId: number): boolean {
  return sessions.has(sessionId);
}

export function updatePtyRef(sessionId: number, pty: IPty) {
  sessions.set(sessionId, { pty, sessionId });
}

export function removePtyRef(sessionId: number) {
  sessions.delete(sessionId);
}

export function resizePty(sessionId: number, cols: number, rows: number) {
  const s = sessions.get(sessionId);
  if (s) s.pty.resize(cols, rows);
}

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
