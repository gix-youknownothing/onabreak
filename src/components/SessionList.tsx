import { invoke } from "@tauri-apps/api/core";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from "react";
import { useChatStore, Workspace } from "../stores/chatStore";
import DeleteConfirmModal from "./DeleteConfirmModal";
import WorkspaceInfoPopover from "./WorkspaceInfoPopover";

interface WorkspaceInspectResult {
  isGitRepo: boolean;
  branch: string | null;
  resolvedWorkDir: string;
}

interface WorkspaceInspectCacheEntry {
  data: WorkspaceInspectResult;
  fetchedAt: number;
}

interface InfoPopoverState {
  workspaceId: number;
  anchorEl: HTMLButtonElement;
  pinned: boolean;
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
  onInfoHoverStart: (ws: Workspace, anchorEl: HTMLButtonElement) => void;
  onInfoHoverEnd: (workspaceId: number) => void;
  onInfoToggle: (e: React.MouseEvent<HTMLButtonElement>, ws: Workspace) => void;
  isPinned: boolean;
  isCompleted: boolean;
  unreadCount: number;
  hasStreaming: boolean;
  isInfoVisible: boolean;
  isInfoOpen: boolean;
}

const INSPECT_CACHE_TTL_MS = 15_000;
const INFO_OPEN_DELAY_MS = 150;
const INFO_CLOSE_DELAY_MS = 120;

function isTauriRuntime() {
  return (
    typeof window !== "undefined" &&
    (("__TAURI_INTERNALS__" in window) || ("__TAURI__" in window))
  );
}

function getErrorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "读取失败";
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
  onInfoHoverStart,
  onInfoHoverEnd,
  onInfoToggle,
  isPinned,
  isCompleted,
  unreadCount,
  hasStreaming,
  isInfoVisible,
  isInfoOpen,
}: WorkspaceItemProps) {
  return (
    <div
      className={`group mb-0.5 flex h-[50px] items-center gap-3 rounded-[10px] px-3 transition-all duration-200 ${
        isActive
          ? "bg-macos-card ring-1 ring-macos-blue/40 shadow-sm"
          : "hover:bg-macos-card/50"
      }`}
      style={{ cursor: editingId === ws.id ? "default" : "pointer" }}
      onClick={() => {
        if (editingId !== ws.id) {
          useChatStore.getState().selectWorkspace(ws);
        }
      }}
    >
      <div className="relative h-[34px] w-[34px] shrink-0" title={hasStreaming ? "有会话正在输出" : undefined}>
        {hasStreaming && (
          <span
            className="pointer-events-none absolute inset-[-3px] z-0 rounded-full workspace-stream-halo"
            aria-hidden
          />
        )}
        <div
          className={`relative z-[1] flex h-[34px] w-[34px] items-center justify-center rounded-full transition-all ${
            isActive ? "bg-macos-blue-soft text-macos-blue" : "bg-macos-elevated/60 text-macos-tertiary"
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {isCompleted && !isActive && (
            <span className="absolute -right-0.5 -top-0.5 z-[2] h-2.5 w-2.5 rounded-full border-2 border-macos-bg bg-macos-green" />
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1">
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
            className="h-8 w-full rounded-lg border border-macos-blue bg-macos-bg px-2 text-[13px] font-medium text-macos-text outline-none"
          />
        ) : (
          <span
            className={`flex min-w-0 items-center gap-1.5 truncate text-[13px] font-medium leading-tight ${
              isActive ? "text-macos-text" : "text-macos-secondary"
            }`}
            onDoubleClick={(e) => onStartRenaming(e, ws)}
          >
            {isPinned && (
              <svg className="h-3 w-3 shrink-0 text-macos-orange" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
              </svg>
            )}
            <span className="truncate">{ws.name}</span>
          </span>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {unreadCount > 0 && (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-macos-green px-1 text-[10px] font-semibold leading-none text-white shadow-sm ring-1 ring-white/10">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}

        <button
          type="button"
          onClick={(e) => onInfoToggle(e, ws)}
          onMouseEnter={(e) => onInfoHoverStart(ws, e.currentTarget)}
          onMouseLeave={() => onInfoHoverEnd(ws.id)}
          onFocus={(e) => onInfoHoverStart(ws, e.currentTarget)}
          onBlur={() => onInfoHoverEnd(ws.id)}
          className={`rounded-lg p-1 transition-all ${
            isInfoVisible
              ? "opacity-100 text-macos-tertiary hover:bg-macos-blue-soft hover:text-macos-blue"
              : "opacity-0 group-hover:opacity-100 text-macos-tertiary hover:bg-macos-blue-soft hover:text-macos-blue"
          } ${isInfoOpen ? "bg-macos-blue-soft text-macos-blue" : ""}`}
          title="查看详情"
          aria-label={`查看 ${ws.name} 详情`}
          aria-haspopup="dialog"
          aria-expanded={isInfoOpen}
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        <button
          onClick={(e) => onTogglePin(e, ws)}
          className={`rounded-lg p-1 opacity-0 transition-all group-hover:opacity-100 ${
            isPinned ? "text-macos-orange hover:bg-macos-orange/10" : "text-macos-tertiary hover:bg-macos-blue-soft hover:text-macos-blue"
          }`}
          title={isPinned ? "取消置顶" : "置顶"}
        >
          <svg className="h-3.5 w-3.5" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
          </svg>
        </button>

        <button
          onClick={(e) => onStartRenaming(e, ws)}
          className="rounded-lg p-1 text-macos-tertiary opacity-0 transition-all group-hover:opacity-100 hover:bg-macos-blue-soft hover:text-macos-blue"
          title="重命名"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>

        <button
          onClick={(e) => onDelete(e, ws)}
          className="rounded-lg p-1 text-macos-tertiary opacity-0 transition-all group-hover:opacity-100 hover:bg-macos-red/10 hover:text-macos-red"
          title="删除"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
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
  const [workspaceInspectById, setWorkspaceInspectById] = useState<Record<number, WorkspaceInspectCacheEntry>>({});
  const [workspaceInspectLoadingById, setWorkspaceInspectLoadingById] = useState<Record<number, boolean>>({});
  const [workspaceInspectErrorById, setWorkspaceInspectErrorById] = useState<Record<number, string>>({});
  const [infoPopoverState, setInfoPopoverState] = useState<InfoPopoverState | null>(null);

  const renameInputRef = useRef<HTMLInputElement>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

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

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const clearInfoTimers = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
  }, [clearCloseTimer, clearOpenTimer]);

  useEffect(() => () => clearInfoTimers(), [clearInfoTimers]);

  useEffect(() => {
    if (
      infoPopoverState &&
      (
        !workspaces.some((ws) => ws.id === infoPopoverState.workspaceId) ||
        !document.body.contains(infoPopoverState.anchorEl)
      )
    ) {
      setInfoPopoverState(null);
    }
  }, [infoPopoverState, workspaces]);

  const loadWorkspaceInspect = useCallback(async (ws: Workspace) => {
    const cacheEntry = workspaceInspectById[ws.id];

    if (workspaceInspectLoadingById[ws.id]) {
      return;
    }

    if (cacheEntry && Date.now() - cacheEntry.fetchedAt < INSPECT_CACHE_TTL_MS) {
      return;
    }

    setWorkspaceInspectLoadingById((prev) => ({ ...prev, [ws.id]: true }));

    try {
      if (!isTauriRuntime()) {
        throw new Error("仅桌面端支持读取 Workspace 详情");
      }

      const result = await invoke<WorkspaceInspectResult>("inspect_workspace", {
        workDir: ws.work_dir,
      });

      setWorkspaceInspectById((prev) => ({
        ...prev,
        [ws.id]: {
          data: result,
          fetchedAt: Date.now(),
        },
      }));
      setWorkspaceInspectErrorById((prev) => {
        if (!(ws.id in prev)) return prev;
        const next = { ...prev };
        delete next[ws.id];
        return next;
      });
    } catch (error) {
      setWorkspaceInspectErrorById((prev) => ({
        ...prev,
        [ws.id]: getErrorMessage(error),
      }));
      setWorkspaceInspectById((prev) => ({
        ...prev,
        [ws.id]: {
          data: cacheEntry?.data ?? {
            isGitRepo: false,
            branch: null,
            resolvedWorkDir: ws.work_dir,
          },
          fetchedAt: Date.now(),
        },
      }));
    } finally {
      setWorkspaceInspectLoadingById((prev) => ({ ...prev, [ws.id]: false }));
    }
  }, [workspaceInspectById, workspaceInspectErrorById, workspaceInspectLoadingById]);

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

  const scheduleCloseInfoPopover = useCallback((workspaceId: number) => {
    clearOpenTimer();
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setInfoPopoverState((current) => {
        if (!current || current.workspaceId !== workspaceId || current.pinned) {
          return current;
        }
        return null;
      });
    }, INFO_CLOSE_DELAY_MS);
  }, [clearCloseTimer, clearOpenTimer]);

  const handleInfoHoverStart = useCallback((ws: Workspace, anchorEl: HTMLButtonElement) => {
    clearCloseTimer();
    if (infoPopoverState?.pinned && infoPopoverState.workspaceId !== ws.id) {
      return;
    }

    clearOpenTimer();
    openTimerRef.current = window.setTimeout(() => {
      setInfoPopoverState((current) => {
        if (current?.pinned && current.workspaceId !== ws.id) {
          return current;
        }
        return {
          workspaceId: ws.id,
          anchorEl,
          pinned: current?.workspaceId === ws.id ? current.pinned : false,
        };
      });
      void loadWorkspaceInspect(ws);
    }, INFO_OPEN_DELAY_MS);
  }, [clearCloseTimer, clearOpenTimer, infoPopoverState, loadWorkspaceInspect]);

  const handleInfoHoverEnd = useCallback((workspaceId: number) => {
    scheduleCloseInfoPopover(workspaceId);
  }, [scheduleCloseInfoPopover]);

  const handleInfoToggle = useCallback((e: React.MouseEvent<HTMLButtonElement>, ws: Workspace) => {
    e.stopPropagation();
    clearInfoTimers();

    setInfoPopoverState((current) => {
      if (current?.workspaceId === ws.id && current.pinned) {
        return null;
      }
      return {
        workspaceId: ws.id,
        anchorEl: e.currentTarget,
        pinned: true,
      };
    });

    void loadWorkspaceInspect(ws);
  }, [clearInfoTimers, loadWorkspaceInspect]);

  const activePopoverWorkspace = infoPopoverState
    ? workspaces.find((ws) => ws.id === infoPopoverState.workspaceId) ?? null
    : null;
  const activeInspectEntry = infoPopoverState
    ? workspaceInspectById[infoPopoverState.workspaceId]
    : undefined;
  const activeInspectError = infoPopoverState
    ? workspaceInspectErrorById[infoPopoverState.workspaceId]
    : undefined;
  const activeInspectLoading = infoPopoverState
    ? workspaceInspectLoadingById[infoPopoverState.workspaceId] ?? false
    : false;

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-3 pt-4">
        {dbStatus === "error" && (
          <div className="mb-3 rounded-[10px] border border-macos-yellow/20 bg-macos-yellow/6 px-3 py-2 text-[12px] text-macos-yellow">
            {dbError ?? "database unavailable. run `npm run tauri dev` to start."}
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-[15px] font-semibold tracking-tight text-macos-text">Workspaces</h1>
          <button
            onClick={() => canUseDb && onOpenCreateWorkspace()}
            disabled={!canUseDb}
            className={`flex h-8 w-8 items-center justify-center rounded-[10px] text-white transition-all duration-200 ${
              canUseDb ? "bg-macos-blue shadow-macos-sm hover:bg-macos-blue-hover" : "cursor-not-allowed bg-macos-elevated opacity-50"
            }`}
            title="new workspace"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-macos-tertiary"
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
            className="w-full rounded-lg border border-macos-border bg-macos-elevated/60 py-[7px] pl-9 pr-3 text-[13px] text-macos-text placeholder:text-macos-quaternary transition-all focus:border-macos-blue/40 focus:outline-none focus:ring-1 focus:ring-macos-blue/40"
          />
        </div>
      </div>

      <div className="scrollbar-hidden flex-1 overflow-y-auto px-2" style={{ overscrollBehavior: "contain" }}>
        {filtered.map((ws) => {
          const isActive = currentWorkspace?.id === ws.id;
          const wsSessionIds = workspaceSessionIds[ws.id] || [];
          const unreadMessageSum = wsSessionIds.reduce(
            (sum, sid) => sum + (unreadSessionCounts[sid] ?? 0),
            0,
          );
          const hasStreaming = wsSessionIds.some((sid) => sessionStatuses[sid] === "streaming");
          const isInfoOpen = infoPopoverState?.workspaceId === ws.id;

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
              onInfoHoverStart={handleInfoHoverStart}
              onInfoHoverEnd={handleInfoHoverEnd}
              onInfoToggle={handleInfoToggle}
              isPinned={ws.is_pinned === 1}
              isCompleted={ws.is_completed === 1}
              unreadCount={unreadMessageSum}
              hasStreaming={hasStreaming}
              isInfoVisible={Boolean(isActive || isInfoOpen)}
              isInfoOpen={Boolean(isInfoOpen)}
            />
          );
        })}

        {filtered.length === 0 && (
          <div className="py-8 text-center text-[13px] text-macos-tertiary">
            {searchQuery ? "未找到匹配项" : "暂无 Workspaces"}
          </div>
        )}
      </div>

      <div className="mt-auto border-t border-macos-border px-3 py-3">
        <button
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-macos-tertiary transition-all hover:bg-macos-card/50 hover:text-macos-text"
          title="设置"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-[13px] font-medium">设置</span>
        </button>
      </div>

      {infoPopoverState && activePopoverWorkspace && (
        <WorkspaceInfoPopover
          anchorEl={infoPopoverState.anchorEl}
          inspectResult={activeInspectEntry?.data}
          isLoading={activeInspectLoading}
          error={activeInspectError}
          onRequestClose={() => {
            clearInfoTimers();
            setInfoPopoverState(null);
          }}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={() => scheduleCloseInfoPopover(infoPopoverState.workspaceId)}
        />
      )}

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
