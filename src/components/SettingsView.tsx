import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { providerRegistry } from "../lib/providerRegistry";
import {
  CATEGORY_LABELS,
  type ProviderCategory,
  type SessionProvider,
  type ProviderParam,
} from "../lib/providers";
import {
  useSettingsStore,
  DEFAULT_SHORTCUTS,
  formatShortcut,
} from "../stores/settingsStore";
import { useChatStore } from "../stores/chatStore";
import ProviderIcon from "./ProviderIcon";

type SettingsSection = "providers" | "shortcuts";

interface EditState {
  provider: SessionProvider;
  isNew: boolean;
}

function generateId(): string {
  return `custom-${Date.now().toString(36)}`;
}

function ParamEditor({
  param,
  value,
  onChange,
}: {
  param: ProviderParam;
  value: any;
  onChange: (val: any) => void;
}) {
  if (param.type === "boolean") {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-macos-border bg-macos-card accent-macos-blue"
        />
        <span className="text-[13px] text-macos-secondary">{param.label}</span>
      </label>
    );
  }

  if (param.type === "select" && param.options) {
    return (
      <div>
        <label className="block text-[11px] text-macos-tertiary mb-1">{param.label}</label>
        <select
          value={value || param.defaultValue || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2.5 py-1.5 bg-macos-card border border-macos-border rounded-lg text-[13px] text-macos-text focus:outline-none focus:ring-1 focus:ring-macos-blue/40"
        >
          {param.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-[11px] text-macos-tertiary mb-1">{param.label}</label>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={param.defaultValue || ""}
        className="w-full px-2.5 py-1.5 bg-macos-card border border-macos-border rounded-lg text-[13px] text-macos-text placeholder:text-macos-quaternary focus:outline-none focus:ring-1 focus:ring-macos-blue/40"
      />
    </div>
  );
}

function ProviderEditForm({
  editState,
  onSave,
  onCancel,
}: {
  editState: EditState;
  onSave: (provider: SessionProvider) => void;
  onCancel: () => void;
}) {
  const [provider, setProvider] = useState<SessionProvider>({ ...editState.provider });
  const [paramValues, setParamValues] = useState<Record<string, any>>(() => {
    const vals: Record<string, any> = {};
    for (const p of editState.provider.params) {
      vals[p.key] = p.defaultValue || "";
    }
    return vals;
  });

  const updateField = <K extends keyof SessionProvider>(key: K, value: SessionProvider[K]) => {
    setProvider((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    const updatedParams = provider.params.map((p) => ({
      ...p,
      defaultValue: paramValues[p.key] || p.defaultValue,
    }));
    onSave({ ...provider, params: updatedParams });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="w-8 h-8 rounded-lg hover:bg-macos-card flex items-center justify-center text-macos-tertiary hover:text-macos-text transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-[17px] font-semibold text-macos-text">
          {editState.isNew ? "新建 Provider" : `配置: ${editState.provider.name}`}
        </h2>
      </div>

      <div className="space-y-4 max-w-lg">
        <div>
          <label className="block text-[11px] text-macos-tertiary mb-1">名称</label>
          <input
            type="text"
            value={provider.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full px-2.5 py-1.5 bg-macos-card border border-macos-border rounded-lg text-[13px] text-macos-text focus:outline-none focus:ring-1 focus:ring-macos-blue/40"
          />
        </div>

        {!provider.isBuiltin && (
          <>
            <div>
              <label className="block text-[11px] text-macos-tertiary mb-1">命令</label>
              <input
                type="text"
                value={provider.command}
                onChange={(e) => updateField("command", e.target.value)}
                placeholder="e.g. claude, codex, cursor-agent"
                className="w-full px-2.5 py-1.5 bg-macos-card border border-macos-border rounded-lg text-[13px] text-macos-text placeholder:text-macos-quaternary focus:outline-none focus:ring-1 focus:ring-macos-blue/40"
              />
            </div>

            <div>
              <label className="block text-[11px] text-macos-tertiary mb-1">类别</label>
              <select
                value={provider.category}
                onChange={(e) => updateField("category", e.target.value as ProviderCategory)}
                className="w-full px-2.5 py-1.5 bg-macos-card border border-macos-border rounded-lg text-[13px] text-macos-text focus:outline-none focus:ring-1 focus:ring-macos-blue/40"
              >
                <option value="ai-agent">AI Agent</option>
                <option value="terminal">终端</option>
                <option value="browser">浏览器</option>
                <option value="document">文档</option>
              </select>
            </div>

            <div className="border border-macos-border rounded-xl p-3 space-y-2">
              <div className="text-[11px] text-macos-tertiary mb-2">Session 管理</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-macos-quaternary mb-0.5">新建参数</label>
                  <input
                    type="text"
                    value={provider.sessionManagement?.newSessionArg || ""}
                    onChange={(e) =>
                      updateField("sessionManagement", {
                        newSessionArg: e.target.value,
                        resumeArg: provider.sessionManagement?.resumeArg || "",
                        stalePatterns: provider.sessionManagement?.stalePatterns || [],
                      })
                    }
                    placeholder="--session-id"
                    className="w-full px-2 py-1 bg-macos-card border border-macos-border rounded-lg text-[11px] text-macos-text placeholder:text-macos-quaternary focus:outline-none focus:ring-1 focus:ring-macos-blue/40"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-macos-quaternary mb-0.5">恢复参数</label>
                  <input
                    type="text"
                    value={provider.sessionManagement?.resumeArg || ""}
                    onChange={(e) =>
                      updateField("sessionManagement", {
                        newSessionArg: provider.sessionManagement?.newSessionArg || "",
                        resumeArg: e.target.value,
                        stalePatterns: provider.sessionManagement?.stalePatterns || [],
                      })
                    }
                    placeholder="--resume"
                    className="w-full px-2 py-1 bg-macos-card border border-macos-border rounded-lg text-[11px] text-macos-text placeholder:text-macos-quaternary focus:outline-none focus:ring-1 focus:ring-macos-blue/40"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {provider.params.length > 0 && (
          <div className="space-y-3">
            <div className="text-[11px] text-macos-tertiary">参数默认值</div>
            {provider.params.map((param) => (
              <ParamEditor
                key={param.key}
                param={param}
                value={paramValues[param.key]}
                onChange={(val) =>
                  setParamValues((prev) => ({ ...prev, [param.key]: val }))
                }
              />
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-macos-card text-macos-secondary rounded-lg hover:bg-macos-elevated text-[13px] font-medium transition-colors border border-macos-border"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-macos-blue text-white rounded-lg hover:bg-macos-blue-hover text-[13px] font-medium transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function ProvidersContent() {
  const { db } = useChatStore();
  const {
    defaultProviderId,
    quickProviderIds,
    setDefaultProvider,
    setQuickProviders,
    saveCustomProvider,
    deleteCustomProvider,
  } = useSettingsStore();

  const [editState, setEditState] = useState<EditState | null>(null);

  const allProviders = useMemo(() => providerRegistry.getAll(), []);
  const categories = useMemo(() => {
    const map = new Map<ProviderCategory, SessionProvider[]>();
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

  const handleEditProvider = (provider: SessionProvider) => {
    setEditState({ provider: { ...provider }, isNew: false });
  };

  const handleNewCustomProvider = () => {
    setEditState({
      provider: {
        id: generateId(),
        name: "",
        icon: "terminal",
        category: "ai-agent",
        viewType: "terminal",
        command: "",
        params: [],
        isBuiltin: false,
      },
      isNew: true,
    });
  };

  const handleSaveEdit = async (provider: SessionProvider) => {
    if (!db) return;
    await saveCustomProvider(db, provider);
    setEditState(null);
  };

  const handleDeleteCustom = async (providerId: string) => {
    if (!db) return;
    await deleteCustomProvider(db, providerId);
  };

  if (editState) {
    return (
      <ProviderEditForm
        editState={editState}
        onSave={handleSaveEdit}
        onCancel={() => setEditState(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-terminal-100 font-mono">Provider 管理</h2>

      {/* Default provider selector */}
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

      {/* Provider list by category */}
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
                      {p.isBuiltin ? "built-in" : "custom"}
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

                  <button
                    onClick={() => handleEditProvider(p)}
                    className="w-7 h-7 rounded flex items-center justify-center text-terminal-500 hover:text-terminal-200 transition-colors"
                    title="配置"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>

                  {!p.isBuiltin && (
                    <button
                      onClick={() => handleDeleteCustom(p.id)}
                      className="w-7 h-7 rounded flex items-center justify-center text-terminal-500 hover:text-red-400 transition-colors"
                      title="删除"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Add custom provider button */}
      <button
        onClick={handleNewCustomProvider}
        className="flex items-center gap-2 px-4 py-2.5 bg-terminal-800 text-terminal-300 rounded-md hover:bg-terminal-700 text-sm font-mono transition-colors border border-terminal-700"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        添加自定义 Provider
      </button>
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

      // Escape cancels recording
      if (e.key === "Escape") {
        stopRecording();
        return;
      }

      // Ignore pure modifier key presses
      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;

      const updated = [...shortcuts];
      updated[recordingIndex] = {
        ...updated[recordingIndex],
        key: e.key,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
      };

      if (db) saveShortcuts(db, updated);
      stopRecording();
    };

    // Use capture phase to intercept before other handlers
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
                  按下新的快捷键...
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
        {/* Settings nav sidebar */}
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

        {/* Settings content */}
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
