import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import {
  spawnPty,
  writeToPty,
  resizePty,
  notifyPtyData,
  notifyPtyExit,
  notifyUserInput,
} from "../lib/ptyManager";
import { providerRegistry } from "../lib/providerRegistry";
import {
  getCachedTerminalSession,
  setCachedTerminalSession,
} from "../lib/terminalSessionCache";
import {
  hasConflictingPrimaryShortcutModifier,
  isPrimaryShortcutModifierPressed,
} from "../lib/platform";
import type { SessionProvider } from "../lib/providers";

interface TerminalViewProps {
  sessionId: number;
  provider: SessionProvider;
  sessionConfig: Record<string, any>;
  workDir: string;
  onPtyExit: (sessionId: number, exitCode: number) => void;
}

interface TerminalSession {
  term: Terminal;
  fit: FitAddon;
}

export default function TerminalView({
  sessionId,
  provider,
  sessionConfig,
  workDir,
  onPtyExit,
}: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);
  const termSessionRef = useRef<TerminalSession | null>(null);
  const logsRef = useRef<string[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [logCount, setLogCount] = useState(0);

  const addLog = useCallback((msg: string) => {
    logsRef.current = [...logsRef.current, msg];
    setLogCount(logsRef.current.length);
  }, []);

  const doSpawnProcess = useCallback(
    (term: Terminal) => {
      const command = providerRegistry.buildSpawnArgs(provider, { sessionConfig });
      const label = `${command.file} ${command.args.join(" ")}`.trim();
      addLog(`Spawning: ${label}`);

      let pty;
      try {
        pty = spawnPty(sessionId, command, {
          cols: term.cols,
          rows: term.rows,
          cwd: workDir || undefined,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        addLog(`Sync spawn error: ${errMsg}`);
        return;
      }

      const ptyAny = pty as { _init?: Promise<unknown>; pid?: number };
      if (ptyAny._init && typeof ptyAny._init.then === "function") {
        ptyAny._init
          .then(() => {
            addLog(`PTY process started (pid: ${pty.pid})`);
          })
          .catch((err: unknown) => {
            const errMsg = err instanceof Error ? err.message : String(err);
            addLog(`PTY async spawn failed: ${errMsg}`);
            if (provider.command) {
              addLog(`Ensure '${provider.command}' CLI is installed and available in PATH`);
            }
          });
      }

      pty.onData((rawData: unknown) => {
        notifyPtyData(sessionId);

        if (typeof rawData === "string") {
          term.write(rawData);
          return;
        }

        if (rawData instanceof Uint8Array) {
          term.write(rawData);
          return;
        }

        if (Array.isArray(rawData)) {
          term.write(new Uint8Array(rawData));
          return;
        }

        term.write(String(rawData));
      });

      pty.onExit(({ exitCode }) => {
        addLog(`Process exited (code ${exitCode})`);
        notifyPtyExit(sessionId);
        onPtyExit(sessionId, exitCode);
      });
    },
    [addLog, onPtyExit, provider, sessionConfig, sessionId, workDir],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || initRef.current) return;
    initRef.current = true;

    const existing = getCachedTerminalSession(sessionId);
    if (existing && existing.term.element) {
      container.appendChild(existing.term.element);
      existing.fit.fit();
      termSessionRef.current = existing;
      return;
    }

    const term = new Terminal({
      fontFamily:
        "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.35,
      cursorBlink: true,
      cursorStyle: "bar",
      theme: {
        background: "#1C1917",
        foreground: "#E7E5E4",
        cursor: "#7CC47F",
        selectionBackground: "#44403C",
        black: "#1C1917",
        red: "#EF4444",
        green: "#7CC47F",
        yellow: "#F59E0B",
        blue: "#60A5FA",
        magenta: "#C084FC",
        cyan: "#22D3EE",
        white: "#E7E5E4",
        brightBlack: "#57534E",
        brightRed: "#FCA5A5",
        brightGreen: "#A7F3D0",
        brightYellow: "#FDE68A",
        brightBlue: "#93C5FD",
        brightMagenta: "#D8B4FE",
        brightCyan: "#67E8F9",
        brightWhite: "#FAFAF9",
      },
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);

    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.type !== "keydown") return true;
      if (
        !isPrimaryShortcutModifierPressed(event) ||
        event.altKey ||
        hasConflictingPrimaryShortcutModifier(event)
      ) {
        return true;
      }
      if (event.code === "KeyC") {
        if (term.hasSelection()) {
          event.preventDefault();
          const text = term.getSelection();
          void navigator.clipboard.writeText(text);
          return false;
        }
        return true;
      }
      if (event.code === "KeyV") {
        event.preventDefault();
        void navigator.clipboard.readText().then((text) => {
          if (!text) return;
          const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
          writeToPty(sessionId, normalized);
        });
        return false;
      }
      return true;
    });

    requestAnimationFrame(() => {
      fit.fit();
      addLog(`Terminal ready (${term.cols}x${term.rows})`);

      const ts: TerminalSession = { term, fit };
      setCachedTerminalSession(sessionId, ts);
      termSessionRef.current = ts;

      doSpawnProcess(term);

      term.onData((data: string) => {
        writeToPty(sessionId, data);
        if (data.includes("\r") || data.includes("\n")) {
          notifyUserInput(sessionId);
        }
      });
    });
  }, [addLog, doSpawnProcess, sessionId]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      const ts = termSessionRef.current;
      if (!ts) return;
      ts.fit.fit();
      resizePty(sessionId, ts.term.cols, ts.term.rows);
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [sessionId]);

  return (
    <div className="flex-1 min-h-0 flex flex-col relative min-w-0" style={{ backgroundColor: "#1C1917" }}>
      {logCount > 0 && (
        <div className="flex-shrink-0" style={{ backgroundColor: "#1C1917" }}>
          <button
            onClick={() => setLogsExpanded((value) => !value)}
            className="w-full flex items-center gap-1.5 px-3 py-1 text-[11px] text-stone-500 hover:text-stone-400 transition-colors"
            style={{ backgroundColor: "#1C1917" }}
          >
            <svg
              className={`w-3 h-3 transition-transform ${logsExpanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>{logCount} startup log{logCount > 1 ? "s" : ""}</span>
          </button>
          {logsExpanded && (
            <div
              className="px-3 pb-2 text-[11px] font-mono text-stone-500 space-y-0.5 max-h-40 overflow-y-auto"
              style={{ backgroundColor: "#292524" }}
            >
              {logsRef.current.map((log, index) => (
                <div key={index} className="flex gap-1.5">
                  <span className="text-stone-600 flex-shrink-0">›</span>
                  <span className="break-all">{log}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div
        className="flex-1 min-h-0 flex flex-col pt-3"
        style={{ backgroundColor: "#1C1917" }}
      >
        <div
          ref={containerRef}
          className="flex-1 min-h-0 overflow-hidden"
          style={{ backgroundColor: "#1C1917" }}
        />
      </div>
    </div>
  );
}
