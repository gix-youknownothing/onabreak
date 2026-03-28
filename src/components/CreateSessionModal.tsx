import { useState } from "react";
import { useChatStore } from "../stores/chatStore";

async function pickDirectory(): Promise<string | null> {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ directory: true, multiple: false });
    return typeof selected === "string" ? selected : null;
  } catch {
    return null;
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreateSessionModal({ open, onClose }: Props) {
  const { createWorkspace, dbStatus } = useChatStore();
  const [name, setName] = useState("");
  const [workDir, setWorkDir] = useState("");

  const canUseDb = dbStatus === "ready";

  const handlePickDir = async () => {
    const dir = await pickDirectory();
    if (dir) {
      setWorkDir(dir);
      if (!name.trim()) {
        const parts = dir.replace(/\\/g, "/").split("/");
        setName(parts[parts.length - 1] || "");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUseDb || !workDir.trim()) return;
    const wsName = name.trim() || workDir.replace(/\\/g, "/").split("/").pop() || "新工作区";
    await createWorkspace(wsName, workDir.trim());
    resetAndClose();
  };

  const resetAndClose = () => {
    setName("");
    setWorkDir("");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={resetAndClose} />
      <div className="relative w-full max-w-md mx-4 bg-terminal-900 border border-terminal-700 rounded-lg shadow-xl shadow-black/40 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-lg font-semibold text-terminal-100 font-mono">new workspace</h2>
          <button
            onClick={resetAndClose}
            className="w-8 h-8 rounded-md hover:bg-terminal-800 flex items-center justify-center text-terminal-500 hover:text-terminal-100 transition-colors border border-transparent hover:border-terminal-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">
          {/* Work directory */}
          <div>
            <label className="block text-sm font-medium text-terminal-400 mb-2">working directory</label>
            <button
              type="button"
              onClick={handlePickDir}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md border transition-colors text-left ${
                workDir
                  ? "border-terminal-700 bg-terminal-800/40"
                  : "border-dashed border-terminal-600 bg-terminal-800/20 hover:border-terminal-500"
              }`}
            >
              <svg className="w-5 h-5 text-terminal-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              {workDir ? (
                <span className="text-sm text-terminal-100 truncate font-mono">{workDir}</span>
              ) : (
                <span className="text-sm text-terminal-500">select project folder...</span>
              )}
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-terminal-400 mb-2">
              name <span className="text-terminal-500 font-normal">(optional, uses dir name by default)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="name this workspace..."
              className="w-full px-3 py-2.5 bg-terminal-800 border border-terminal-700 rounded-md text-sm text-terminal-100 placeholder:text-terminal-500 focus:outline-none focus:ring-1 focus:ring-accent-500/50 focus:border-accent-500/50 transition-colors font-mono"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={resetAndClose}
              className="flex-1 px-4 py-2.5 bg-terminal-800 text-terminal-400 rounded-md hover:bg-terminal-700 text-sm font-medium transition-colors border border-terminal-700"
            >
              cancel
            </button>
            <button
              type="submit"
              disabled={!canUseDb || !workDir.trim()}
              className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                canUseDb && workDir.trim()
                  ? "bg-accent-500 text-white hover:bg-accent-600 border border-accent-400/30"
                  : "bg-terminal-700 text-terminal-500 cursor-not-allowed border border-terminal-600"
              }`}
            >
              create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
