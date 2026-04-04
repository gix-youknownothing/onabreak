import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useChatStore, Session, SessionStatus } from "../stores/chatStore";
import { providerRegistry } from "../lib/providerRegistry";
import SessionView from "./SessionView";
import ProviderIcon from "./ProviderIcon";
import { ProviderPickerPortal } from "./ProviderPicker";

function TabSessionIndicators({
  status,
  unreadCount,
}: {
  status?: SessionStatus;
  unreadCount: number;
}) {
  const showStreaming = status === "streaming";
  const showExited = status === "exited" && !showStreaming;

  return (
    <>
      {showStreaming && (
        <span className="relative flex h-2 w-2 shrink-0" title="工作中">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-macos-blue opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-macos-blue" />
        </span>
      )}
      {unreadCount > 0 && (
        <span
          className="min-w-[16px] h-4 px-0.5 rounded-full bg-macos-green text-white text-[9px] font-semibold flex items-center justify-center leading-none shrink-0"
          title={`未读 ${unreadCount}`}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
      {showExited && (
        <span className="inline-flex rounded-full h-2 w-2 shrink-0 bg-macos-tertiary" title="已退出" />
      )}
    </>
  );
}

export interface ChatViewHandle {
  cycleTab: (direction: 1 | -1) => void;
  jumpToTab: (index: number) => void;
  createSession: () => void;
}

interface ChatViewProps {
  onNavigateToSettings: () => void;
}

interface SortableSessionTabProps {
  session: Session;
  isActive: boolean;
  isRenaming: boolean;
  status?: SessionStatus;
  unreadCount: number;
  sessionsCount: number;
  renamingTabName: string;
  tabInputRef: React.RefObject<HTMLInputElement>;
  onSelect: (session: Session) => void;
  onStartRenaming: (e: React.MouseEvent, sessionId: number, name: string) => void;
  onDelete: (e: React.MouseEvent, sessionId: number) => void;
  onRenameChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
}

function SessionTabVisual({
  session,
  isActive,
  isRenaming,
  isDragging = false,
  status,
  unreadCount,
  sessionsCount,
  renamingTabName,
  tabInputRef,
  onSelect,
  onStartRenaming,
  onDelete,
  onRenameChange,
  onCommitRename,
  onCancelRename,
}: SortableSessionTabProps & { isDragging?: boolean }) {
  return (
    <div
      className={`group flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-lg whitespace-nowrap min-w-[120px] max-w-[200px] select-none shrink-0 transition-[background-color,color,box-shadow,opacity] duration-150 ${
        isActive
          ? "bg-macos-card text-macos-text shadow-macos-sm"
          : "text-macos-tertiary hover:text-macos-secondary hover:bg-macos-card/50"
      } ${
        isDragging
          ? "cursor-grabbing shadow-macos-sm ring-1 ring-white/10"
          : isRenaming
            ? "cursor-text"
            : "cursor-grab active:cursor-grabbing"
      }`}
      onClick={() => onSelect(session)}
      onDoubleClick={(e) => onStartRenaming(e, session.id, session.name)}
    >
      <ProviderIcon providerId={session.provider_id} size="xs" />
      <TabSessionIndicators status={status} unreadCount={unreadCount} />
      {isRenaming ? (
        <input
          ref={tabInputRef}
          value={renamingTabName}
          onChange={(e) => onRenameChange(e.target.value)}
          onBlur={onCommitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitRename();
            if (e.key === "Escape") onCancelRename();
          }}
          onClick={(e) => e.stopPropagation()}
          className="bg-macos-card text-macos-text border border-macos-blue rounded-lg px-1.5 py-0 text-[12px] outline-none w-20"
        />
      ) : (
        <span className="truncate min-w-0">{session.name}</span>
      )}
      {sessionsCount > 1 && !isRenaming && (
        <button
          className="opacity-0 group-hover:opacity-100 ml-0.5 w-4 h-4 flex items-center justify-center rounded text-macos-tertiary hover:text-macos-red hover:bg-macos-red/10 transition-all"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => onDelete(e, session.id)}
          title="close session"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function SortableSessionTab(props: SortableSessionTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props.session.id,
    disabled: props.isRenaming,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.18 : 1,
    zIndex: isDragging ? 10 : "auto",
    willChange: "transform",
    touchAction: props.isRenaming ? "auto" : "none",
  };

  return (
    <div ref={setNodeRef} style={style} className="shrink-0" {...attributes} {...listeners}>
      <SessionTabVisual {...props} isDragging={false} />
    </div>
  );
}

const ChatView = forwardRef<ChatViewHandle, ChatViewProps>(function ChatView({ onNavigateToSettings }, ref) {
  const {
    currentWorkspace,
    currentSession,
    sessions,
    sessionStatuses,
    unreadSessionCounts,
    selectSession,
    createSession,
    deleteSession,
    renameSession,
    reorderSessions,
  } = useChatStore();

  const [renamingTabId, setRenamingTabId] = useState<number | null>(null);
  const [renamingTabName, setRenamingTabName] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draggingTabId, setDraggingTabId] = useState<number | null>(null);
  const tabInputRef = useRef<HTMLInputElement>(null);
  const addBtnRef = useRef<HTMLDivElement>(null);
  const suppressTabClickRef = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 0 },
    }),
  );

  const handleCreateSessionWithDefault = useCallback(() => {
    if (!currentWorkspace || sessions.length >= 10) return;
    const defaultProvider = providerRegistry.getDefault();
    const nextNum = sessions.length + 1;
    createSession(`Session ${nextNum}`, defaultProvider.id);
  }, [currentWorkspace, sessions.length, createSession]);

  useImperativeHandle(ref, () => ({
    cycleTab(direction: 1 | -1) {
      const totalTabs = sessions.length;
      if (totalTabs <= 1) return;
      const sIdx = currentSession ? sessions.findIndex((s) => s.id === currentSession.id) : 0;
      const currentIdx = sIdx === -1 ? 0 : sIdx;
      const next = (currentIdx + direction + totalTabs) % totalTabs;
      selectSession(sessions[next]);
    },
    jumpToTab(index: number) {
      if (index >= 0 && index < sessions.length) {
        selectSession(sessions[index]);
      }
    },
    createSession() {
      handleCreateSessionWithDefault();
    },
  }), [sessions, currentSession, selectSession, handleCreateSessionWithDefault]);

  const handlePtyExit = useCallback((_sessionId: number, _exitCode: number) => {}, []);

  const handleCreateSessionWithProvider = useCallback(
    (providerId: string) => {
      if (!currentWorkspace || sessions.length >= 10) return;
      const provider = providerRegistry.get(providerId);
      const nextNum = sessions.length + 1;
      const name = provider ? `${provider.name} ${nextNum}` : `Session ${nextNum}`;
      createSession(name, providerId);
      setPickerOpen(false);
    },
    [currentWorkspace, sessions.length, createSession],
  );

  const handleDeleteSessionTab = useCallback(
    (e: React.MouseEvent, sessionId: number) => {
      e.stopPropagation();
      deleteSession(sessionId);
    },
    [deleteSession],
  );

  const startRenamingTab = (e: React.MouseEvent, sessionId: number, name: string) => {
    e.stopPropagation();
    setRenamingTabId(sessionId);
    setRenamingTabName(name);
    setTimeout(() => tabInputRef.current?.select(), 0);
  };

  const commitTabRename = () => {
    if (renamingTabId !== null && renamingTabName.trim()) {
      renameSession(renamingTabId, renamingTabName);
    }
    setRenamingTabId(null);
    setRenamingTabName("");
  };

  const cancelTabRename = useCallback(() => {
    setRenamingTabId(null);
    setRenamingTabName("");
  }, []);

  const handleSelectSession = useCallback((session: Session) => {
    if (suppressTabClickRef.current) return;
    selectSession(session);
  }, [selectSession]);

  const handleTabDragStart = useCallback((event: DragStartEvent) => {
    setDraggingTabId(Number(event.active.id));
    suppressTabClickRef.current = true;
  }, []);

  const handleTabDragEnd = useCallback((event: DragEndEvent) => {
    setDraggingTabId(null);
    const { active, over } = event;
    window.setTimeout(() => {
      suppressTabClickRef.current = false;
    }, 0);
    if (!over || active.id === over.id) return;

    const oldIndex = sessions.findIndex((session) => session.id === active.id);
    const newIndex = sessions.findIndex((session) => session.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sessions, oldIndex, newIndex).map((session) => session.id);
    reorderSessions(reordered);
  }, [sessions, reorderSessions]);

  const handleTabDragCancel = useCallback(() => {
    setDraggingTabId(null);
    window.setTimeout(() => {
      suppressTabClickRef.current = false;
    }, 0);
  }, []);

  const draggingSession = draggingTabId === null
    ? null
    : sessions.find((session) => session.id === draggingTabId) ?? null;

  if (!currentWorkspace) return null;

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <div className="h-11 border-b border-macos-border bg-macos-sidebar/80 backdrop-blur-[40px] px-3 flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto overflow-y-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleTabDragStart}
            onDragEnd={handleTabDragEnd}
            onDragCancel={handleTabDragCancel}
          >
            <SortableContext items={sessions.map((session) => session.id)} strategy={horizontalListSortingStrategy}>
              {sessions.map((session) => {
                const isActive = currentSession?.id === session.id;
                const status = sessionStatuses[session.id];
                const tabUnreadCount = unreadSessionCounts[session.id] ?? 0;
                const isRenaming = renamingTabId === session.id;

                return (
                  <SortableSessionTab
                    key={session.id}
                    session={session}
                    isActive={isActive}
                    isRenaming={isRenaming}
                    status={status}
                    unreadCount={tabUnreadCount}
                    sessionsCount={sessions.length}
                    renamingTabName={renamingTabName}
                    tabInputRef={tabInputRef}
                    onSelect={handleSelectSession}
                    onStartRenaming={startRenamingTab}
                    onDelete={handleDeleteSessionTab}
                    onRenameChange={setRenamingTabName}
                    onCommitRename={commitTabRename}
                    onCancelRename={cancelTabRename}
                  />
                );
              })}
            </SortableContext>
            {createPortal(
              <DragOverlay dropAnimation={null}>
                {draggingSession ? (
                  <SessionTabVisual
                    session={draggingSession}
                    isActive={currentSession?.id === draggingSession.id}
                    isRenaming={false}
                    isDragging
                    status={sessionStatuses[draggingSession.id]}
                    unreadCount={unreadSessionCounts[draggingSession.id] ?? 0}
                    sessionsCount={sessions.length}
                    renamingTabName=""
                    tabInputRef={tabInputRef}
                    onSelect={handleSelectSession}
                    onStartRenaming={startRenamingTab}
                    onDelete={handleDeleteSessionTab}
                    onRenameChange={setRenamingTabName}
                    onCommitRename={commitTabRename}
                    onCancelRename={cancelTabRename}
                  />
                ) : null}
              </DragOverlay>,
              document.body
            )}
          </DndContext>

          <div ref={addBtnRef} className="relative flex items-center flex-shrink-0">
            <button
              className={`w-6 h-6 rounded-l-lg flex items-center justify-center transition-colors ${
                sessions.length >= 10
                  ? "text-macos-quaternary cursor-not-allowed"
                  : "text-macos-tertiary hover:text-macos-text hover:bg-macos-card/50"
              }`}
              onClick={sessions.length >= 10 ? undefined : handleCreateSessionWithDefault}
              disabled={sessions.length >= 10}
              title={sessions.length >= 10 ? "最多创建 10 个 session" : "新建 session (默认 Provider)"}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              className={`w-4 h-6 rounded-r-lg flex items-center justify-center text-macos-tertiary hover:text-macos-text hover:bg-macos-card/50 transition-colors ${
                pickerOpen ? "bg-macos-card/50 text-macos-text" : ""
              }`}
              onClick={() => setPickerOpen((p) => !p)}
              title="选择 Provider"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
        {pickerOpen && addBtnRef.current && createPortal(
          <ProviderPickerPortal
            anchorEl={addBtnRef.current}
            onSelect={handleCreateSessionWithProvider}
            onManage={() => {
              setPickerOpen(false);
              onNavigateToSettings();
            }}
            onClose={() => setPickerOpen(false)}
          />,
          document.body
        )}
      </div>

      <div className="flex-1 flex flex-col min-h-0">
      {currentSession ? (
        <div className="flex-1 flex flex-col min-h-0">
          <SessionView
            session={currentSession}
            workspace={currentWorkspace}
            onPtyExit={handlePtyExit}
          />
        </div>
      ) : null}
      </div>

    </div>
  );
});

export default ChatView;
