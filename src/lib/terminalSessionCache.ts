import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";

const terminalCache = new Map<number, { term: Terminal; fit: FitAddon }>();

export function getCachedTerminalSession(sessionId: number) {
  return terminalCache.get(sessionId);
}

export function setCachedTerminalSession(
  sessionId: number,
  ts: { term: Terminal; fit: FitAddon },
) {
  terminalCache.set(sessionId, ts);
}

/** Dispose xterm instance and drop cache entry (call when deleting a session). */
export function disposeTerminalSession(sessionId: number) {
  const t = terminalCache.get(sessionId);
  if (t) {
    try {
      t.term.dispose();
    } catch {
      /* ignore */
    }
    terminalCache.delete(sessionId);
  }
}
