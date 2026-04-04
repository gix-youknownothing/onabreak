import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { providerRegistry } from "../lib/providerRegistry";
import {
  getPrimaryShortcutModifierLabel,
  hasConflictingPrimaryShortcutModifier,
  isPrimaryShortcutModifierPressed,
} from "../lib/platform";
import { CATEGORY_LABELS, type ProviderCategory } from "../lib/providers";
import {
  useSettingsStore,
  DEFAULT_SHORTCUTS,
  formatShortcut,
} from "../stores/settingsStore";
import { useChatStore } from "../stores/chatStore";
import ProviderIcon from "./ProviderIcon";

type SettingsSection = "providers" | "shortcuts";

function ProvidersContent() {
  const { db } = useChatStore();
  const {
    defaultProviderId,
    quickProviderIds,
    setDefaultProvider,
    setQuickProviders,
  } = useSettingsStore();

  const allProviders = useMemo(() => providerRegistry.getAll(), []);
  const categories = useMemo(() => {
    const map = new Map<ProviderCategory, typeof allProviders>();
    for (const p of allProviders) {
      const list = map.get(p.category) || [];
      list.push(p);
      map.set(p.category, list);
    }
    return map;
  }, [allProviders]);

  const categoryOrder: ProviderCategory[] = ["ai-agent", "terminal", "browser", "document"];

  const handleSetDefault = async (providerId: string) => {
    if (!db) return;
    await setDefaultProvider(db, providerId);
  };

  const handleToggleQuick = async (providerId: string) => {
    if (!db) return;
    const newIds = quickProviderIds.includes(providerId)
      ? quickProviderIds.filter((id) => id !== providerId)
      : [...quickProviderIds, providerId];
    await setQuickProviders(db, newIds);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-terminal-100 font-mono">Provider 管理</h2>

      <div className="max-w-sm">
        <label className="block text-xs text-terminal-400 mb-1.5 font-mono">默认 Provider</label>
        <select
          value={defaultProviderId}
          onChange={(e) => handleSetDefault(e.target.value)}
          className="w-full px-3 py-2 bg-terminal-800 border border-terminal-700 rounded-md text-sm text-terminal-200 font-mono focus:outline-none focus:ring-1 focus:ring-accent-500/50"
        >
          {allProviders.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {categoryOrder.map((cat) => {
          const providers = categories.get(cat);
          if (!providers || providers.length === 0) return null;

          return (
            <div key={cat} className="border border-terminal-700 rounded-md overflow-hidden">
              <div className="px-3 py-2 bg-terminal-800/50 text-xs text-terminal-400 font-mono font-semibold uppercase tracking-wider">
                {CATEGORY_LABELS[cat]}
              </div>
              {providers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 px-3 py-2.5 border-t border-terminal-700/50 hover:bg-terminal-800/30 transition-colors"
                >
                  <ProviderIcon providerId={p.id} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-terminal-200 font-mono truncate">
                      {p.name}
                    </div>
                    <div className="text-[10px] text-terminal-500 font-mono">
                      built-in
                      {p.command && ` · ${p.command}`}
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleQuick(p.id)}
                    className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                      quickProviderIds.includes(p.id)
                        ? "text-accent-400 hover:text-accent-300"
                        : "text-terminal-600 hover:text-terminal-400"
                    }`}
                    title={quickProviderIds.includes(p.id) ? "从快捷栏移除" : "添加到快捷栏"}
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShortcutsContent() {
  const { db } = useChatStore();
  const { shortcuts, saveShortcuts, setRecordingShortcut } = useSettingsStore();
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleRecord = useCallback(
    (index: number) => {
      setRecordingIndex(index);
      setRecordingShortcut(true);
    },
    [setRecordingShortcut],
  );

  const stopRecording = useCallback(() => {
    setRecordingIndex(null);
    setRecordingShortcut(false);
  }, [setRecordingShortcut]);

  useEffect(() => {
    if (recordingIndex === null) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        stopRecording();
        return;
      }

      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
      if (hasConflictingPrimaryShortcutModifier(e)) return;

      const updated = [...shortcuts];
      updated[recordingIndex] = {
        ...updated[recordingIndex],
        key: e.key,
        ctrlKey: isPrimaryShortcutModifierPressed(e),
        altKey: e.altKey,
        shiftKey: e.shiftKey,
      };

      if (db) saveShortcuts(db, updated);
      stopRecording();
    };

    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [recordingIndex, shortcuts, db, saveShortcuts, stopRecording]);

  const handleResetDefaults = async () => {
    if (!db) return;
    await saveShortcuts(db, DEFAULT_SHORTCUTS);
  };

  return (
    <div ref={containerRef} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-terminal-100 font-mono">快捷键设置</h2>
        <button
          onClick={handleResetDefaults}
          className="px-3 py-1.5 text-xs font-mono text-terminal-400 hover:text-terminal-200 bg-terminal-800 border border-terminal-700 rounded-md hover:bg-terminal-700 transition-colors"
        >
          恢复默认
        </button>
      </div>

      <div className="border border-terminal-700 rounded-md overflow-hidden">
        {shortcuts.map((sc, i) => (
          <div
            key={sc.action}
            className="flex items-center gap-3 px-4 py-3 border-b border-terminal-700/50 last:border-b-0 hover:bg-terminal-800/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm text-terminal-200 font-mono">{sc.label}</div>
            </div>
            <div className="flex items-center gap-2">
              {recordingIndex === i ? (
                <span className="px-3 py-1 text-xs font-mono text-accent-400 bg-accent-100 border border-accent-300/30 rounded-md animate-pulse">
                  按下新的快捷键...{getPrimaryShortcutModifierLabel()} 会作为主修饰键
                </span>
              ) : (
                <kbd className="px-2.5 py-1 text-xs font-mono text-terminal-300 bg-terminal-800 border border-terminal-600 rounded-md">
                  {formatShortcut(sc)}
                </kbd>
              )}
              <button
                onClick={() => handleRecord(i)}
                className="w-7 h-7 rounded flex items-center justify-center text-terminal-500 hover:text-terminal-200 transition-colors"
                title="修改快捷键"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const SECTIONS: { id: SettingsSection; label: string; icon: JSX.Element }[] = [
  {
    id: "providers",
    label: "Provider",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    id: "shortcuts",
    label: "快捷键",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
];

interface SettingsViewProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsView({ open, onClose }: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("providers");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-[840px] h-[600px] max-h-[85vh] rounded-2xl border border-macos-border bg-[#1e1e1e] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-48 flex-shrink-0 border-r border-macos-border bg-[#252525] flex flex-col">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <h1 className="text-sm font-semibold text-macos-text tracking-tight">设置</h1>
            <button
              onClick={onClose}
              className="w-6 h-6 rounded-md flex items-center justify-center text-macos-tertiary hover:text-macos-text hover:bg-macos-card/60 transition-colors"
              title="关闭"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="flex-1 px-2 space-y-0.5">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors text-left ${
                  activeSection === section.id
                    ? "bg-macos-card text-macos-text shadow-macos-sm"
                    : "text-macos-tertiary hover:text-macos-secondary hover:bg-macos-card/50"
                }`}
              >
                {section.icon}
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto p-6" style={{ minHeight: 540 }}>
          <div className="max-w-lg">
            {activeSection === "providers" && <ProvidersContent />}
            {activeSection === "shortcuts" && <ShortcutsContent />}
          </div>
        </div>
      </div>
    </div>
  );
}
