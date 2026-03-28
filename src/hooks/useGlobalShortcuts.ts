import { useEffect, useRef } from "react";
import type { ShortcutConfig } from "../stores/settingsStore";

interface ShortcutActions {
  switchWorkspace: (direction: 1 | -1) => void;
  cycleSessionTab: (direction: 1 | -1) => void;
  jumpToTab: (index: number) => void;
  openSettings: () => void;
  createWorkspace: () => void;
  createSession: () => void;
}

function isInsideTerminal(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  return !!target.closest(".xterm");
}

function isInsideInput(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

function matchesShortcut(e: KeyboardEvent, s: ShortcutConfig): boolean {
  if (e.ctrlKey !== s.ctrlKey) return false;
  if (e.altKey !== s.altKey) return false;
  if (e.shiftKey !== s.shiftKey) return false;
  // Compare key case-insensitively for letter keys
  return e.key.toLowerCase() === s.key.toLowerCase();
}

function fireAction(action: string, a: ShortcutActions): void {
  switch (action) {
    case "switchWorkspaceUp":
      a.switchWorkspace(-1);
      break;
    case "switchWorkspaceDown":
      a.switchWorkspace(1);
      break;
    case "cycleSessionTabLeft":
      a.cycleSessionTab(-1);
      break;
    case "cycleSessionTabRight":
      a.cycleSessionTab(1);
      break;
    case "openSettings":
      a.openSettings();
      break;
    case "createWorkspace":
      a.createWorkspace();
      break;
    case "createSession":
      a.createSession();
      break;
  }
}

export function useGlobalShortcuts(actions: ShortcutActions, shortcuts: ShortcutConfig[], paused = false) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (pausedRef.current) return;

      const a = actionsRef.current;
      const inTerminal = isInsideTerminal(e.target);
      const inInput = isInsideInput(e.target);

      for (const sc of shortcutsRef.current) {
        if (!matchesShortcut(e, sc)) continue;

        // Check scope
        if (sc.scope === "terminal-excluded" && inTerminal) continue;
        if (sc.scope === "input-excluded" && inInput) continue;

        e.preventDefault();
        fireAction(sc.action, a);
        return;
      }
    };

    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, []);
}
