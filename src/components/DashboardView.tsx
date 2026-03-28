import { useState, useCallback, useRef, useMemo } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { useChatStore, type Workspace, type SessionStatus } from "../stores/chatStore";
import { providerRegistry } from "../lib/providerRegistry";
import ProviderIcon from "./ProviderIcon";
import ProviderPicker from "./ProviderPicker";

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso + "Z").getTime();
  const diff = now - then;
  if (diff < 0) return "刚刚";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "刚刚";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 个月前`;
  return `${Math.floor(months / 12)} 年前`;
}

function StatusDot({ status }: { status?: SessionStatus }) {
  if (!status) return null;
  if (status === "streaming") {
    return (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-macos-blue opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-macos-blue" />
      </span>
    );
  }
  if (status === "idle") {
    return <span className="inline-flex rounded-full h-2 w-2 bg-macos-green" />;
  }
  if (status === "exited") {
    return <span className="inline-flex rounded-full h-2 w-2 bg-macos-tertiary" />;
  }
  return null;
}

function statusLabel(status?: SessionStatus): string {
  if (status === "streaming") return "工作中";
  if (status === "idle") return "空闲";
  if (status === "exited") return "已退出";
  return "未启动";
}

interface DashboardViewProps {
  workspace: Workspace;
  onSelectSession: (sessionId: number) => void;
}

export default function DashboardView({ workspace, onSelectSession }: DashboardViewProps) {
  const { sessions, sessionStatuses, createSession } = useChatStore();

  const [pickerOpen, setPickerOpen] = useState(false);
  const moreBtnRef = useRef<HTMLElement>(null);

  const handleOpenInExplorer = useCallback(() => {
    if (workspace.work_dir) {
      open(workspace.work_dir).catch(console.error);
    }
  }, [workspace.work_dir]);

  const handleQuickCreate = useCallback(
    (providerId: string) => {
      const provider = providerRegistry.get(providerId);
      const nextNum = sessions.length + 1;
      const name = provider ? `${provider.name} ${nextNum}` : `Session ${nextNum}`;
      createSession(name, providerId);
    },
    [sessions.length, createSession],
  );

  const handlePickerCreate = useCallback(
    (providerId: string) => {
      handleQuickCreate(providerId);
      setPickerOpen(false);
    },
    [handleQuickCreate],
  );

  const quickProviders = useMemo(() => providerRegistry.getQuickList(), []);

  const statusCounts = useMemo(() => {
    let streaming = 0, idle = 0, exited = 0;
    for (const s of sessions) {
      const st = sessionStatuses[s.id];
      if (st === "streaming") streaming++;
      else if (st === "idle") idle++;
      else if (st === "exited") exited++;
    }
    return { streaming, idle, exited };
  }, [sessions, sessionStatuses]);

  return (
    <div className="flex-1 overflow-y-auto bg-macos-bg">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Section 1: Project Info */}
        <div className="bg-macos-card/50 border border-macos-border rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-semibold text-macos-text truncate">
                {workspace.name}
              </h2>
              {workspace.work_dir && (
                <button
                  onClick={handleOpenInExplorer}
                  className="mt-1 text-[13px] text-macos-secondary hover:text-macos-blue truncate block max-w-full text-left transition-colors"
                  title={workspace.work_dir}
                >
                  {workspace.work_dir}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {workspace.work_dir && (
                <button
                  onClick={handleOpenInExplorer}
                  className="px-3 py-1.5 text-[12px] text-macos-secondary bg-macos-elevated/60 border border-macos-border rounded-lg hover:bg-macos-elevated hover:text-macos-text transition-all"
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    打开目录
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4 text-[12px] text-macos-tertiary">
            <span>创建于 {relativeTime(workspace.created_at)}</span>
            <span className="w-px h-3 bg-macos-border" />
            <span>{sessions.length} 个 Session</span>
            {statusCounts.streaming > 0 && (
              <>
                <span className="w-px h-3 bg-macos-border" />
                <span className="text-macos-blue">{statusCounts.streaming} 工作中</span>
              </>
            )}
            {statusCounts.idle > 0 && (
              <>
                <span className="w-px h-3 bg-macos-border" />
                <span className="text-macos-green">{statusCounts.idle} 空闲</span>
              </>
            )}
          </div>
        </div>

        {/* Section 2: Sessions at a Glance */}
        {sessions.length > 0 && (
          <div>
            <h3 className="text-[13px] font-medium text-macos-secondary mb-3">会话概览</h3>
            <div className="grid grid-cols-2 gap-3">
              {sessions.map((session) => {
                const status = sessionStatuses[session.id];
                const provider = providerRegistry.get(session.provider_id);
                return (
                  <button
                    key={session.id}
                    onClick={() => onSelectSession(session.id)}
                    className="bg-macos-card/50 border border-macos-border rounded-xl p-3.5 text-left hover:border-macos-blue/30 hover:bg-macos-card transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <ProviderIcon providerId={session.provider_id} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-macos-text truncate group-hover:text-macos-text">
                            {session.name}
                          </span>
                          <StatusDot status={status} />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-macos-tertiary">
                            {provider?.name ?? session.provider_id}
                          </span>
                          <span className="text-[11px] text-macos-quaternary">
                            {statusLabel(status)}
                          </span>
                          {session.cli_session_id && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-macos-elevated/60 text-macos-tertiary">
                              可恢复
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 3: Quick Launch */}
        <div>
          <h3 className="text-[13px] font-medium text-macos-secondary mb-3">快捷启动</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {quickProviders.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleQuickCreate(provider.id)}
                className="flex items-center gap-2 px-3 py-2 bg-macos-card/50 border border-macos-border rounded-xl text-[13px] text-macos-secondary hover:bg-macos-card hover:border-macos-blue/30 hover:text-macos-text transition-all"
              >
                <ProviderIcon providerId={provider.id} size="xs" />
                {provider.name}
              </button>
            ))}
            <div className="relative">
              <button
                ref={moreBtnRef as React.RefObject<HTMLButtonElement>}
                onClick={() => setPickerOpen((p) => !p)}
                className="flex items-center gap-1.5 px-3 py-2 bg-macos-card/50 border border-macos-border rounded-xl text-[13px] text-macos-tertiary hover:bg-macos-card hover:text-macos-secondary transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                更多
              </button>
              {pickerOpen && (
                <ProviderPicker
                  anchorRef={moreBtnRef}
                  onSelect={handlePickerCreate}
                  onManage={() => setPickerOpen(false)}
                  onClose={() => setPickerOpen(false)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
