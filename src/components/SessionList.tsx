import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import {
  useChatStore,
  Workspace,
} from "../stores/chatStore";
import DeleteConfirmModal from "./DeleteConfirmModal";

function parseSqliteDate(dateStr: string): Date {
  const str = dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr.replace(" ", "T") + "Z";
  return new Date(str);
}

function formatTime(dateStr: string) {
  const date = parseSqliteDate(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (days === 0) return timeStr;
  if (days === 1) return `昨天 ${timeStr}`;
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
}

function shortenPath(path: string, maxLen = 28) {
  const normalized = path.replace(/\\/g, "/");
  if (normalized.length <= maxLen) return normalized;
  const parts = normalized.split("/");
  if (parts.length <= 2) return "..." + normalized.slice(-(maxLen - 3));
  return parts[0] + "/.../" + parts[parts.length - 1];
}

interface WorkspaceItemProps {
  ws: Workspace;
  isActive: boolean;
  editingId: number | null;
  editingName: string;
  renameInputRef: React.RefObject<HTMLInputElement>;
  onStartRenaming: (e: React.MouseEvent, ws: Workspace) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onEditingNameChange: (name: string) => void;
  onDelete: (e: React.MouseEvent, ws: Workspace) => void;
  onTogglePin: (e: React.MouseEvent, ws: Workspace) => void;
  isPinned: boolean;
  isCompleted: boolean;
  unreadCount: number;
  hasStreaming: boolean;
}

function WorkspaceItem({
  ws,
  isActive,
  editingId,
  editingName,
  renameInputRef,
  onStartRenaming,
  onCommitRename,
  onCancelRename,
  onEditingNameChange,
  onDelete,
  onTogglePin,
  isPinned,
  isCompleted,
  unreadCount,
  hasStreaming,
}: WorkspaceItemProps) {
  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-[10px] cursor-pointer mb-0.5 transition-all duration-200 ${
        isActive
          ? "bg-macos-card ring-1 ring-macos-blue/40 shadow-sm"
          : "hover:bg-macos-card/50"
      }`}
      onClick={() => {
        if (editingId !== ws.id) {
          useChatStore.getState().selectWorkspace(ws);
        }
      }}
    >
      <div className="relative h-9 w-9 shrink-0" title={hasStreaming ? "有会话正在输出" : undefined}>
        {hasStreaming && (
          <span
            className="pointer-events-none absolute inset-[-3px] z-0 rounded-full workspace-stream-halo"
            aria-hidden
          />
        )}
        <div
          className={`relative z-[1] flex h-9 w-9 rounded-full items-center justify-center transition-all ${
            isActive ? "bg-macos-blue-soft text-macos-blue" : "bg-macos-elevated/60 text-macos-tertiary"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {isCompleted && !isActive && (
            <span className="absolute -top-0.5 -right-0.5 z-[2] w-2.5 h-2.5 bg-macos-green rounded-full border-2 border-macos-bg" />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0 flex items-center py-0.5">
        <div className="flex flex-col items-stretch w-full min-w-0">
          <div className="flex items-center justify-between gap-2 w-full min-h-[1.25rem]">
            {editingId === ws.id ? (
              <input
                ref={renameInputRef}
                value={editingName}
                onChange={(e) => onEditingNameChange(e.target.value)}
                onBlur={onCommitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onCommitRename();
                  if (e.key === "Escape") onCancelRename();
                }}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-[13px] bg-macos-bg text-macos-text border border-macos-blue rounded-lg px-2 py-0.5 outline-none min-w-0 flex-1"
              />
            ) : (
              <span
                className={`font-medium truncate text-[13px] flex items-center gap-1.5 min-w-0 flex-1 leading-tight ${
                  isActive ? "text-macos-text" : "text-macos-secondary"
                }`}
                onDoubleClick={(e) => onStartRenaming(e, ws)}
              >
                {isPinned && (
                  <svg className="w-3 h-3 text-macos-orange flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                  </svg>
                )}
                <span className="truncate">{ws.name}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5 flex-shrink-0 self-center">
              {unreadCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-macos-green text-white text-[10px] font-semibold flex items-center justify-center leading-none shadow-sm ring-1 ring-white/10">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}

              <span className="text-[11px] text-macos-tertiary">
                {formatTime(ws.updated_at)}
              </span>
            </span>
          </div>
          {ws.work_dir && (
            <div className="flex items-center justify-start gap-1 mt-0.5 w-full min-w-0">
              <svg className="w-3 h-3 text-macos-tertiary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="text-[11px] text-macos-tertiary truncate text-left">{shortenPath(ws.work_dir)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end mt-0.5">
          <div className="flex items-center gap-0.5">
            <button
              onClick={(e) => onTogglePin(e, ws)}
              className={`opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all ${
                isPinned ? "text-macos-orange hover:bg-macos-orange/10" : "text-macos-tertiary hover:text-macos-blue hover:bg-macos-blue-soft"
              }`}
              title={isPinned ? "取消置顶" : "置顶"}
            >
              <svg className="w-3.5 h-3.5" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
              </svg>
            </button>
            <button
              onClick={(e) => onStartRenaming(e, ws)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-macos-tertiary hover:text-macos-blue hover:bg-macos-blue-soft transition-all"
              title="重命名"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={(e) => onDelete(e, ws)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-macos-tertiary hover:text-macos-red hover:bg-macos-red/10 transition-all"
              title="删除"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface SessionListHandle {
  startRenamingCurrent: () => void;
}

interface SessionListProps {
  onOpenCreateWorkspace: () => void;
  onOpenSettings: () => void;
}

const SessionList = forwardRef<SessionListHandle, SessionListProps>(function SessionList(
  { onOpenCreateWorkspace, onOpenSettings },
  ref,
) {
  const {
    workspaces,
    currentWorkspace,
    workspaceSessionIds,
    renameWorkspace,
    deleteWorkspace,
    togglePinWorkspace,
    dbStatus,
    dbError,
    unreadSessionCounts,
    sessionStatuses,
  } = useChatStore();

  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    startRenamingCurrent() {
      if (currentWorkspace) {
        setEditingId(currentWorkspace.id);
        setEditingName(currentWorkspace.name);
      }
    },
  }), [currentWorkspace]);

  useEffect(() => {
    if (editingId !== null) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [editingId]);

  const startRenaming = (e: React.MouseEvent, ws: Workspace) => {
    e.stopPropagation();
    setEditingId(ws.id);
    setEditingName(ws.name);
  };

  const commitRename = async () => {
    if (editingId !== null && editingName.trim()) {
      await renameWorkspace(editingId, editingName);
    }
    setEditingId(null);
    setEditingName("");
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleTogglePin = async (e: React.MouseEvent, ws: Workspace) => {
    e.stopPropagation();
    await togglePinWorkspace(ws.id);
  };

  const canUseDb = dbStatus === "ready";

  const filtered = workspaces.filter((ws) =>
    ws.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleDeleteWorkspace = (e: React.MouseEvent, ws: Workspace) => {
    e.stopPropagation();
    setDeleteTarget(ws);
  };

  const confirmDelete = async () => {
    if (deleteTarget) {
      await deleteWorkspace(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        {dbStatus === "error" && (
          <div className="mb-3 rounded-[10px] border border-macos-yellow/20 bg-macos-yellow/6 px-3 py-2 text-[12px] text-macos-yellow">
            {dbError ?? "database unavailable. run `npm run tauri dev` to start."}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[15px] font-semibold text-macos-text tracking-tight">Workspaces</h1>
          <button
            onClick={() => canUseDb && onOpenCreateWorkspace()}
            disabled={!canUseDb}
            className={`w-8 h-8 rounded-[10px] flex items-center justify-center text-white transition-all duration-200 ${
              canUseDb ? "bg-macos-blue hover:bg-macos-blue-hover shadow-macos-sm" : "bg-macos-elevated cursor-not-allowed opacity-50"
            }`}
            title="new workspace"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-macos-tertiary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索..."
            className="w-full pl-9 pr-3 py-[7px] bg-macos-elevated/60 border border-macos-border rounded-lg text-[13px] text-macos-text placeholder:text-macos-quaternary focus:outline-none focus:ring-1 focus:ring-macos-blue/40 focus:border-macos-blue/40 transition-all"
          />
        </div>
      </div>

      {/* Workspace list */}
      <div className="flex-1 overflow-y-auto px-2 scrollbar-hidden" style={{ overscrollBehavior: "contain" }}>
        {filtered.map((ws) => {
          const isActive = currentWorkspace?.id === ws.id;
          const wsSessionIds = workspaceSessionIds[ws.id] || [];
          const unreadMessageSum = wsSessionIds.reduce(
            (sum, sid) => sum + (unreadSessionCounts[sid] ?? 0),
            0,
          );
          const hasStreaming = wsSessionIds.some((sid) => sessionStatuses[sid] === "streaming");
          return (
            <WorkspaceItem
              key={ws.id}
              ws={ws}
              isActive={isActive}
              editingId={editingId}
              editingName={editingName}
              renameInputRef={renameInputRef}
              onStartRenaming={startRenaming}
              onCommitRename={commitRename}
              onCancelRename={cancelRename}
              onEditingNameChange={setEditingName}
              onDelete={handleDeleteWorkspace}
              onTogglePin={handleTogglePin}
              isPinned={ws.is_pinned === 1}
              isCompleted={ws.is_completed === 1}
              unreadCount={unreadMessageSum}
              hasStreaming={hasStreaming}
            />
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center text-macos-tertiary text-[13px] py-8">
            {searchQuery ? "未找到匹配项" : "暂无 Workspaces"}
          </div>
        )}
      </div>

      {/* Footer with Settings */}
      <div className="mt-auto px-3 py-3 border-t border-macos-border">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-macos-tertiary hover:text-macos-text hover:bg-macos-card/50 transition-all"
          title="设置"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-[13px] font-medium">设置</span>
        </button>
      </div>

      <DeleteConfirmModal
        open={deleteTarget !== null}
        target={deleteTarget}
        kind="workspace"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
});

export default SessionList;
