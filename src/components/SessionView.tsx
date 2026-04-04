import { useCallback, useMemo } from "react";
import { providerRegistry } from "../lib/providerRegistry";
import type { Session, Workspace } from "../stores/chatStore";
import TerminalView from "./TerminalView";

interface SessionViewProps {
  session: Session;
  workspace: Workspace;
  onPtyExit: (sessionId: number, exitCode: number) => void;
}

export default function SessionView({
  session,
  workspace,
  onPtyExit,
}: SessionViewProps) {
  const provider = useMemo(
    () => providerRegistry.get(session.provider_id) ?? providerRegistry.getDefault(),
    [session.provider_id],
  );

  const sessionConfig = useMemo(() => {
    try {
      return JSON.parse(session.provider_config || "{}");
    } catch {
      return {};
    }
  }, [session.provider_config]);

  const handlePtyExit = useCallback(
    (sid: number, code: number) => onPtyExit(sid, code),
    [onPtyExit],
  );

  switch (provider.viewType) {
    case "terminal":
      return (
        <TerminalView
          key={session.id}
          sessionId={session.id}
          provider={provider}
          sessionConfig={sessionConfig}
          workDir={workspace.work_dir}
          onPtyExit={handlePtyExit}
        />
      );
    case "webview":
      return (
        <div className="flex-1 flex items-center justify-center text-terminal-500 font-mono text-sm">
          WebView (coming soon)
        </div>
      );
    case "document":
      return (
        <div className="flex-1 flex items-center justify-center text-terminal-500 font-mono text-sm">
          Document View (coming soon)
        </div>
      );
    default:
      return (
        <TerminalView
          key={session.id}
          sessionId={session.id}
          provider={provider}
          sessionConfig={sessionConfig}
          workDir={workspace.work_dir}
          onPtyExit={handlePtyExit}
        />
      );
  }
}
