import { useState, useMemo } from "react";
import { providerRegistry } from "../lib/providerRegistry";
import {
  CATEGORY_LABELS,
  type ProviderCategory,
  type SessionProvider,
  type ProviderParam,
} from "../lib/providers";
import { useSettingsStore } from "../stores/settingsStore";
import { useChatStore } from "../stores/chatStore";
import ProviderIcon from "./ProviderIcon";

interface Props {
  open: boolean;
  onClose: () => void;
}

type SettingsTab = "providers" | "edit";

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
          className="w-4 h-4 rounded border-terminal-600 bg-terminal-800 accent-accent-500"
        />
        <span className="text-sm text-terminal-300 font-mono">{param.label}</span>
      </label>
    );
  }

  if (param.type === "select" && param.options) {
    return (
      <div>
        <label className="block text-xs text-terminal-400 mb-1 font-mono">{param.label}</label>
        <select
          value={value || param.defaultValue || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2.5 py-1.5 bg-terminal-800 border border-terminal-700 rounded-md text-sm text-terminal-200 font-mono focus:outline-none focus:ring-1 focus:ring-accent-500/50"
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
      <label className="block text-xs text-terminal-400 mb-1 font-mono">{param.label}</label>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={param.defaultValue || ""}
        className="w-full px-2.5 py-1.5 bg-terminal-800 border border-terminal-700 rounded-md text-sm text-terminal-200 placeholder:text-terminal-500 font-mono focus:outline-none focus:ring-1 focus:ring-accent-500/50"
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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <h2 className="text-lg font-semibold text-terminal-100 font-mono">
          {editState.isNew ? "新建 Provider" : `配置: ${provider.name}`}
        </h2>
        <button
          onClick={onCancel}
          className="w-8 h-8 rounded-md hover:bg-terminal-800 flex items-center justify-center text-terminal-500 hover:text-terminal-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
        <div>
          <label className="block text-xs text-terminal-400 mb-1 font-mono">名称</label>
          <input
            type="text"
            value={provider.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full px-2.5 py-1.5 bg-terminal-800 border border-terminal-700 rounded-md text-sm text-terminal-200 font-mono focus:outline-none focus:ring-1 focus:ring-accent-500/50"
          />
        </div>

        {!provider.isBuiltin && (
          <>
            <div>
              <label className="block text-xs text-terminal-400 mb-1 font-mono">命令</label>
              <input
                type="text"
                value={provider.command}
                onChange={(e) => updateField("command", e.target.value)}
                placeholder="e.g. claude, codex, cursor-agent"
                className="w-full px-2.5 py-1.5 bg-terminal-800 border border-terminal-700 rounded-md text-sm text-terminal-200 placeholder:text-terminal-500 font-mono focus:outline-none focus:ring-1 focus:ring-accent-500/50"
              />
            </div>

            <div>
              <label className="block text-xs text-terminal-400 mb-1 font-mono">类别</label>
              <select
                value={provider.category}
                onChange={(e) => updateField("category", e.target.value as ProviderCategory)}
                className="w-full px-2.5 py-1.5 bg-terminal-800 border border-terminal-700 rounded-md text-sm text-terminal-200 font-mono focus:outline-none focus:ring-1 focus:ring-accent-500/50"
              >
                <option value="ai-agent">AI Agent</option>
                <option value="terminal">终端</option>
                <option value="browser">浏览器</option>
                <option value="document">文档</option>
              </select>
            </div>

            <div className="border border-terminal-700 rounded-md p-3 space-y-2">
              <div className="text-xs text-terminal-400 font-mono mb-2">Session 管理</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-terminal-500 mb-0.5 font-mono">新建参数</label>
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
                    className="w-full px-2 py-1 bg-terminal-800 border border-terminal-700 rounded text-xs text-terminal-200 placeholder:text-terminal-500 font-mono focus:outline-none focus:ring-1 focus:ring-accent-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-terminal-500 mb-0.5 font-mono">恢复参数</label>
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
                    className="w-full px-2 py-1 bg-terminal-800 border border-terminal-700 rounded text-xs text-terminal-200 placeholder:text-terminal-500 font-mono focus:outline-none focus:ring-1 focus:ring-accent-500/50"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Parameter values */}
        {provider.params.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs text-terminal-400 font-mono">参数默认值</div>
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
      </div>

      <div className="flex gap-3 px-6 py-4 border-t border-terminal-700">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-terminal-800 text-terminal-400 rounded-md hover:bg-terminal-700 text-sm font-medium transition-colors border border-terminal-700"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 px-4 py-2 bg-accent-500 text-white rounded-md hover:bg-accent-600 text-sm font-medium transition-colors"
        >
          保存
        </button>
      </div>
    </div>
  );
}

export default function ProviderSettings({ open, onClose }: Props) {
  const { db } = useChatStore();
  const {
    defaultProviderId,
    quickProviderIds,
    setDefaultProvider,
    setQuickProviders,
    saveCustomProvider,
    deleteCustomProvider,
  } = useSettingsStore();

  const [tab, setTab] = useState<SettingsTab>("providers");
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
    setTab("edit");
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
    setTab("edit");
  };

  const handleSaveEdit = async (provider: SessionProvider) => {
    if (!db) return;
    await saveCustomProvider(db, provider);
    setEditState(null);
    setTab("providers");
  };

  const handleDeleteCustom = async (providerId: string) => {
    if (!db) return;
    await deleteCustomProvider(db, providerId);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-terminal-900 border border-terminal-700 rounded-lg shadow-xl shadow-black/40 overflow-hidden max-h-[80vh] flex flex-col">
        {tab === "edit" && editState ? (
          <ProviderEditForm
            editState={editState}
            onSave={handleSaveEdit}
            onCancel={() => {
              setEditState(null);
              setTab("providers");
            }}
          />
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
              <h2 className="text-lg font-semibold text-terminal-100 font-mono">Provider 管理</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-md hover:bg-terminal-800 flex items-center justify-center text-terminal-500 hover:text-terminal-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Default provider selector */}
            <div className="px-6 pb-4 flex-shrink-0">
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

            {/* Provider list */}
            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4 min-h-0">
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
                        className="flex items-center gap-2.5 px-3 py-2 border-t border-terminal-700/50 hover:bg-terminal-800/30 transition-colors"
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

                        {/* Quick access toggle */}
                        <button
                          onClick={() => handleToggleQuick(p.id)}
                          className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
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

                        {/* Edit button */}
                        <button
                          onClick={() => handleEditProvider(p)}
                          className="w-6 h-6 rounded flex items-center justify-center text-terminal-500 hover:text-terminal-200 transition-colors"
                          title="配置"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>

                        {/* Delete (custom only) */}
                        {!p.isBuiltin && (
                          <button
                            onClick={() => handleDeleteCustom(p.id)}
                            className="w-6 h-6 rounded flex items-center justify-center text-terminal-500 hover:text-red-400 transition-colors"
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

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-terminal-700 flex-shrink-0">
              <button
                onClick={handleNewCustomProvider}
                className="flex-1 px-4 py-2 bg-terminal-800 text-terminal-300 rounded-md hover:bg-terminal-700 text-sm font-mono transition-colors border border-terminal-700 flex items-center justify-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                添加自定义 Provider
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-accent-500 text-white rounded-md hover:bg-accent-600 text-sm font-medium transition-colors"
              >
                完成
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
