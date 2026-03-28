import { useEffect, useState, useRef, useCallback } from "react";
import ChatView from "./components/ChatView";
import CreateSessionModal from "./components/CreateSessionModal";
import SessionList from "./components/SessionList";
import SettingsView from "./components/SettingsView";
import TitleBar from "./components/TitleBar";
import { useChatStore } from "./stores/chatStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { initTaskbarBadge } from "./lib/taskbarBadge";
import type { ChatViewHandle } from "./components/ChatView";
import type { SessionListHandle } from "./components/SessionList";

function App() {
  const { initDatabase, loadWorkspaces, currentWorkspace, workspaces, selectWorkspace, db, dbStatus } = useChatStore();
  const { initSettings, initialized: settingsReady, shortcuts, recordingShortcut } = useSettingsStore();
  const [isFullscreen, _setIsFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createWorkspaceModalOpen, setCreateWorkspaceModalOpen] = useState(false);

  const chatViewRef = useRef<ChatViewHandle>(null);
  const sessionListRef = useRef<SessionListHandle>(null);

  useEffect(() => {
    initDatabase().then(() => {
      loadWorkspaces();
    });
    initTaskbarBadge();
  }, [initDatabase, loadWorkspaces]);

  useEffect(() => {
    if (db && !settingsReady) {
      initSettings(db);
    }
  }, [db, settingsReady, initSettings]);

  const switchWorkspace = useCallback(
    (direction: 1 | -1) => {
      if (workspaces.length === 0) return;
      if (!currentWorkspace) {
        selectWorkspace(workspaces[0]);
        return;
      }
      const idx = workspaces.findIndex((w) => w.id === currentWorkspace.id);
      if (idx === -1) return;
      const next = (idx + direction + workspaces.length) % workspaces.length;
      selectWorkspace(workspaces[next]);
    },
    [workspaces, currentWorkspace, selectWorkspace],
  );

  const openCreateWorkspaceModal = useCallback(() => {
    if (dbStatus === "ready") setCreateWorkspaceModalOpen(true);
  }, [dbStatus]);

  useGlobalShortcuts({
    switchWorkspace,
    cycleSessionTab: (dir) => chatViewRef.current?.cycleTab(dir),
    jumpToTab: (idx) => chatViewRef.current?.jumpToTab(idx),
    openSettings: () => setSettingsOpen(true),
    createWorkspace: openCreateWorkspaceModal,
    createSession: () => chatViewRef.current?.createSession(),
  }, shortcuts, recordingShortcut);

  return (
    <div className="flex flex-col h-screen bg-macos-bg text-macos-text">
      {!isFullscreen && <TitleBar />}
      <div className="flex flex-1 min-h-0">
        {!isFullscreen && (
          <aside className="w-[300px] flex-shrink-0 bg-[#252525]/60 backdrop-blur-[40px]">
            <SessionList ref={sessionListRef} onOpenCreateWorkspace={openCreateWorkspaceModal} onOpenSettings={() => setSettingsOpen(true)} />
          </aside>
        )}
        <main className="flex-1 flex flex-col min-w-0">
          {currentWorkspace ? (
            <ChatView ref={chatViewRef} onNavigateToSettings={() => setSettingsOpen(true)} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-macos-card border border-macos-border flex items-center justify-center">
                <svg className="w-8 h-8 text-macos-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-[17px] font-medium text-macos-text">选择或创建一个 Workspace</p>
                <p className="text-[13px] text-macos-secondary mt-1">开始与 AI Agent 对话</p>
              </div>
            </div>
          )}
        </main>
      </div>
      <CreateSessionModal
        open={createWorkspaceModalOpen}
        onClose={() => setCreateWorkspaceModalOpen(false)}
      />
      <SettingsView open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;
