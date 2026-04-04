import { create } from "zustand";
import Database from "@tauri-apps/plugin-sql";
import { DEFAULT_PROVIDER_ID } from "../lib/providers";
import { providerRegistry } from "../lib/providerRegistry";
import { getPrimaryShortcutModifierLabel } from "../lib/platform";

export interface ShortcutConfig {
  action: string;
  label: string;
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  scope: "global" | "terminal-excluded" | "input-excluded";
}

export const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
  { action: "switchWorkspaceUp", label: "切换到上一个工作区", key: "ArrowUp", ctrlKey: true, shiftKey: false, altKey: false, scope: "terminal-excluded" },
  { action: "switchWorkspaceDown", label: "切换到下一个工作区", key: "ArrowDown", ctrlKey: true, shiftKey: false, altKey: false, scope: "terminal-excluded" },
  { action: "cycleSessionTabLeft", label: "切换到上一个标签页", key: "ArrowLeft", ctrlKey: true, shiftKey: false, altKey: false, scope: "terminal-excluded" },
  { action: "cycleSessionTabRight", label: "切换到下一个标签页", key: "ArrowRight", ctrlKey: true, shiftKey: false, altKey: false, scope: "terminal-excluded" },
  { action: "openSettings", label: "打开设置", key: ",", ctrlKey: true, shiftKey: true, altKey: false, scope: "global" },
  { action: "createWorkspace", label: "新建工作区", key: "N", ctrlKey: true, shiftKey: true, altKey: false, scope: "global" },
  { action: "createSession", label: "新建会话", key: "n", ctrlKey: true, shiftKey: false, altKey: false, scope: "terminal-excluded" },
];

export function formatShortcut(s: ShortcutConfig): string {
  const parts: string[] = [];
  if (s.ctrlKey) parts.push(getPrimaryShortcutModifierLabel());
  if (s.altKey) parts.push("Alt");
  if (s.shiftKey) parts.push("Shift");
  const keyDisplay = s.key.length === 1 ? s.key.toUpperCase() : s.key;
  parts.push(keyDisplay);
  return parts.join(" + ");
}

// Merge saved shortcuts with defaults — keeps labels/scope up-to-date, removes deleted actions
function mergeShortcuts(saved: ShortcutConfig[]): ShortcutConfig[] {
  return DEFAULT_SHORTCUTS.map((def) => {
    const match = saved.find((s) => s.action === def.action);
    if (match) {
      return { ...def, key: match.key, ctrlKey: match.ctrlKey, shiftKey: match.shiftKey, altKey: match.altKey };
    }
    return def;
  });
}

interface SettingsState {
  defaultProviderId: string;
  quickProviderIds: string[];
  shortcuts: ShortcutConfig[];
  recordingShortcut: boolean;
  initialized: boolean;

  initSettings: (db: Database) => Promise<void>;
  setDefaultProvider: (db: Database, providerId: string) => Promise<void>;
  setQuickProviders: (db: Database, ids: string[]) => Promise<void>;
  saveShortcuts: (db: Database, shortcuts: ShortcutConfig[]) => Promise<void>;
  setRecordingShortcut: (recording: boolean) => void;
}

async function getSetting(db: Database, key: string): Promise<string | null> {
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = ?",
    [key],
  );
  return rows.length > 0 ? rows[0].value : null;
}

async function setSetting(
  db: Database,
  key: string,
  value: string,
): Promise<void> {
  await db.execute(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    [key, value],
  );
}

export const useSettingsStore = create<SettingsState>((set) => ({
  defaultProviderId: DEFAULT_PROVIDER_ID,
  quickProviderIds: ["claude-cli", "terminal"],
  shortcuts: DEFAULT_SHORTCUTS,
  recordingShortcut: false,
  initialized: false,

  initSettings: async (db: Database) => {
    try {
      const defaultProvider = await getSetting(db, "default_provider");
      const quickProviders = await getSetting(db, "quick_providers");
      const shortcutsRaw = await getSetting(db, "shortcuts");

      const dpId =
        defaultProvider && providerRegistry.get(defaultProvider)
          ? defaultProvider
          : DEFAULT_PROVIDER_ID;
      const qpIds = (quickProviders
        ? JSON.parse(quickProviders)
        : ["claude-cli", "terminal"]
      ).filter((id: string) => providerRegistry.get(id));
      const sc = shortcutsRaw ? mergeShortcuts(JSON.parse(shortcutsRaw)) : DEFAULT_SHORTCUTS;

      providerRegistry.setDefaultProviderId(dpId);
      providerRegistry.setQuickProviderIds(qpIds);

      set({
        defaultProviderId: dpId,
        quickProviderIds: qpIds,
        shortcuts: sc,
        initialized: true,
      });
    } catch (e) {
      console.error("Failed to init settings:", e);
      set({ initialized: true });
    }
  },

  setDefaultProvider: async (db: Database, providerId: string) => {
    const nextProviderId = providerRegistry.get(providerId) ? providerId : DEFAULT_PROVIDER_ID;
    await setSetting(db, "default_provider", nextProviderId);
    providerRegistry.setDefaultProviderId(nextProviderId);
    set({ defaultProviderId: nextProviderId });
  },

  setQuickProviders: async (db: Database, ids: string[]) => {
    const nextIds = ids.filter((id) => providerRegistry.get(id));
    await setSetting(db, "quick_providers", JSON.stringify(nextIds));
    providerRegistry.setQuickProviderIds(nextIds);
    set({ quickProviderIds: nextIds });
  },

  saveShortcuts: async (db: Database, shortcuts: ShortcutConfig[]) => {
    await setSetting(db, "shortcuts", JSON.stringify(shortcuts));
    set({ shortcuts });
  },

  setRecordingShortcut: (recording: boolean) => {
    set({ recordingShortcut: recording });
  },
}));
