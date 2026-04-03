import { useEffect, useRef, useState } from "react";
import { useChatStore, type Workspace } from "../stores/chatStore";

interface WorkspaceNotesViewProps {
  workspace: Workspace;
}

export default function WorkspaceNotesView({ workspace }: WorkspaceNotesViewProps) {
  const { updateWorkspaceNotes } = useChatStore();
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

  return (
    <div className="flex-1 min-h-0 bg-macos-bg">
      <div className="mx-auto flex h-full max-w-5xl flex-col px-6 py-6">
        <div className="flex-1 overflow-hidden rounded-2xl border border-macos-border bg-macos-card/40 shadow-macos-sm">
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="记录项目背景、关键决策、TODO、交接信息..."
            className="h-full min-h-[520px] w-full resize-none border-0 bg-transparent px-6 py-5 text-[14px] leading-7 text-macos-text placeholder:text-macos-tertiary outline-none transition-colors focus:bg-macos-card/55"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
