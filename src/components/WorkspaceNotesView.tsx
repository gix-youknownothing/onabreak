import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { useChatStore, type Workspace } from "../stores/chatStore";

interface WorkspaceNotesViewProps {
  workspace: Workspace;
}

export default function WorkspaceNotesView({ workspace }: WorkspaceNotesViewProps) {
  const { sessions, updateWorkspaceNotes } = useChatStore();
  const [notes, setNotes] = useState(workspace.notes || "");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNotes(workspace.notes || "");
  }, [workspace.id, workspace.notes]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      updateWorkspaceNotes(workspace.id, value);
    }, 300);
  };

  const handleOpenInExplorer = () => {
    if (workspace.work_dir) {
      open(workspace.work_dir).catch(console.error);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-macos-bg">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-macos-card/50 border border-macos-border rounded-2xl overflow-hidden shadow-macos-sm">
          <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-macos-border">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] uppercase tracking-[0.16em] text-macos-tertiary">Workspace Notes</p>
              <h2 className="mt-2 text-[22px] font-semibold text-macos-text truncate">{workspace.name}</h2>
              <p className="mt-2 text-[13px] text-macos-secondary">
                独立于 session 的项目级笔记。当前共 {sessions.length} 个 session。
              </p>
              {workspace.work_dir && (
                <button
                  onClick={handleOpenInExplorer}
                  className="mt-3 text-[13px] text-macos-secondary hover:text-macos-blue truncate block max-w-full text-left transition-colors"
                  title={workspace.work_dir}
                >
                  {workspace.work_dir}
                </button>
              )}
            </div>
            {workspace.work_dir && (
              <button
                onClick={handleOpenInExplorer}
                className="px-3 py-1.5 text-[12px] text-macos-secondary bg-macos-elevated/60 border border-macos-border rounded-lg hover:bg-macos-elevated hover:text-macos-text transition-all"
              >
                打开目录
              </button>
            )}
          </div>

          <div className="p-3 bg-macos-elevated/20">
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="记录项目背景、关键决策、TODO、交接信息..."
              className="w-full min-h-[600px] bg-transparent rounded-xl border border-transparent px-3 py-3 text-[14px] leading-7 text-macos-text placeholder:text-macos-tertiary resize-none outline-none focus:border-macos-blue/40 focus:bg-macos-card/40"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
