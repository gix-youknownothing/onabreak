import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { useChatStore, SessionStatus } from "../stores/chatStore";
import { providerRegistry } from "../lib/providerRegistry";
import SessionView from "./SessionView";
import DashboardView from "./DashboardView";
import ProviderIcon from "./ProviderIcon";
import { ProviderPickerPortal } from "./ProviderPicker";
import SessionNotePanel from "./SessionNotePanel";

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
  } = useChatStore();

  const [renamingTabId, setRenamingTabId] = useState<number | null>(null);
  const [renamingTabName, setRenamingTabName] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const tabInputRef = useRef<HTMLInputElement>(null);
  const addBtnRef = useRef<HTMLDivElement>(null);

  const handleCreateSessionWithDefault = useCallback(() => {
    if (!currentWorkspace || sessions.length >= 10) return;
    const defaultProvider = providerRegistry.getDefault();
    const nextNum = sessions.length + 1;
    createSession(`Session ${nextNum}`, defaultProvider.id);
  }, [currentWorkspace, sessions.length, createSession]);

  const handleDashboardClick = useCallback(async () => {
    useChatStore.setState({ currentSession: null });
    const { db, currentWorkspace } = useChatStore.getState();
    if (db && currentWorkspace) {
      await db.execute(
        "UPDATE workspaces SET last_active_session_id = NULL WHERE id = ?",
        [currentWorkspace.id],
      );
      useChatStore.setState((state) => ({
        currentWorkspace: state.currentWorkspace
          ? { ...state.currentWorkspace, last_active_session_id: null }
          : null,
        workspaces: state.workspaces.map((ws) =>
          ws.id === currentWorkspace.id
            ? { ...ws, last_active_session_id: null }
            : ws,
        ),
      }));
    }
  }, []);

  const isDashboardActive = currentSession === null;

  useImperativeHandle(ref, () => ({
    cycleTab(direction: 1 | -1) {
      // Tab order: Dashboard(0), session[0](1), session[1](2), ...
      const totalTabs = sessions.length + 1;
      if (totalTabs <= 1) return;
      let currentIdx = 0;
      if (currentSession) {
        const sIdx = sessions.findIndex((s) => s.id === currentSession.id);
        currentIdx = sIdx === -1 ? 0 : sIdx + 1;
      }
      const next = (currentIdx + direction + totalTabs) % totalTabs;
      if (next === 0) {
        handleDashboardClick();
      } else {
        selectSession(sessions[next - 1]);
      }
    },
    jumpToTab(index: number) {
      // index 0 = Dashboard, 1 = session[0], ...
      if (index === 0) {
        handleDashboardClick();
      } else if (index >= 1 && index <= sessions.length) {
        selectSession(sessions[index - 1]);
      }
    },
    createSession() {
      handleCreateSessionWithDefault();
    },
  }), [sessions, currentSession, selectSession, handleCreateSessionWithDefault, handleDashboardClick]);

  const handlePtyExit = useCallback((_sessionId: number, _exitCode: number) => {}, []);

  const handleCliSessionCreated = useCallback(
    async (sessionId: number, uuid: string) => {
      const { db, currentSession: cs, sessions: allSessions } = useChatStore.getState();
      if (!db) return;
      try {
        await db.execute(
          "UPDATE sessions SET cli_session_id = ? WHERE id = ?",
          [uuid, sessionId],
        );
        if (cs?.id === sessionId) {
          useChatStore.setState({
            currentSession: { ...cs, cli_session_id: uuid },
          });
        }
        useChatStore.setState({
          sessions: allSessions.map((s) =>
            s.id === sessionId ? { ...s, cli_session_id: uuid } : s,
          ),
        });
      } catch (e) {
        console.error("Failed to save cli_session_id:", e);
      }
    },
    [],
  );

  const handleSelectSessionFromDashboard = useCallback(
    (sessionId: number) => {
      const session = sessions.find((s) => s.id === sessionId);
      if (session) selectSession(session);
    },
    [sessions, selectSession],
  );

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

  if (!currentWorkspace) return null;

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* Unified header: WS info + session tabs */}
      <div className="h-11 border-b border-macos-border bg-macos-sidebar/80 backdrop-blur-[40px] px-3 flex items-center gap-2 flex-shrink-0">
        {/* Dashboard tab + Session tabs */}
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto overflow-y-hidden">
          {/* Fixed Dashboard tab */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-lg cursor-pointer transition-all whitespace-nowrap flex-shrink-0 ${
              isDashboardActive
                ? "bg-macos-card text-macos-text shadow-macos-sm"
                : "text-macos-tertiary hover:text-macos-secondary hover:bg-macos-card/50"
            }`}
            onClick={handleDashboardClick}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 12a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
            </svg>
            <span>Dashboard</span>
          </div>
          {sessions.map((session) => {
            const isActive = currentSession?.id === session.id;
            const status = sessionStatuses[session.id];
            const tabUnreadCount = unreadSessionCounts[session.id] ?? 0;
            const isRenaming = renamingTabId === session.id;

            return (
              <div
                key={session.id}
                className={`group flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-lg cursor-pointer transition-all whitespace-nowrap min-w-[120px] max-w-[200px] ${
                  isActive
                    ? "bg-macos-card text-macos-text shadow-macos-sm"
                    : "text-macos-tertiary hover:text-macos-secondary hover:bg-macos-card/50"
                }`}
                onClick={() => selectSession(session)}
                onDoubleClick={(e) => startRenamingTab(e, session.id, session.name)}
              >
                <ProviderIcon providerId={session.provider_id} size="xs" />
                <TabSessionIndicators status={status} unreadCount={tabUnreadCount} />
                {isRenaming ? (
                  <input
                    ref={tabInputRef}
                    value={renamingTabName}
                    onChange={(e) => setRenamingTabName(e.target.value)}
                    onBlur={commitTabRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitTabRename();
                      if (e.key === "Escape") {
                        setRenamingTabId(null);
                        setRenamingTabName("");
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-macos-card text-macos-text border border-macos-blue rounded-lg px-1.5 py-0 text-[12px] outline-none w-20"
                  />
                ) : (
                  <span className="truncate min-w-0">{session.name}</span>
                )}
                {sessions.length > 1 && !isRenaming && (
                  <button
                    className="opacity-0 group-hover:opacity-100 ml-0.5 w-4 h-4 flex items-center justify-center rounded text-macos-tertiary hover:text-macos-red hover:bg-macos-red/10 transition-all"
                    onClick={(e) => handleDeleteSessionTab(e, session.id)}
                    title="close session"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}

          {/* Split button: + (default) and dropdown — inside scrollable area, after last tab */}
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

      {/* Active content area — no horizontal padding so session/terminal spans full width */}
      <div className="flex-1 flex flex-col min-h-0">
      {isDashboardActive ? (
        <DashboardView
          workspace={currentWorkspace}
          onSelectSession={handleSelectSessionFromDashboard}
        />
      ) : currentSession ? (
        <div className="flex-1 flex flex-col min-h-0 relative">
          <SessionView
            session={currentSession}
            workspace={currentWorkspace}
            onPtyExit={handlePtyExit}
            onCliSessionCreated={handleCliSessionCreated}
          />
          <SessionNotePanel session={currentSession} />
        </div>
      ) : null}
      </div>

    </div>
  );
});

export default ChatView;
