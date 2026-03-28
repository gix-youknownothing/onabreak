import { useEffect, useState, useCallback, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();
const DOUBLE_CLICK_MS = 300;

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const lastClickRef = useRef(0);

  const syncMaximized = useCallback(async () => {
    setIsMaximized(await appWindow.isMaximized());
  }, []);

  useEffect(() => {
    syncMaximized();
    const unlisten = appWindow.onResized(() => {
      syncMaximized();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [syncMaximized]);

  const handleMinimize = () => appWindow.minimize();

  const handleToggleMaximize = () => appWindow.toggleMaximize();

  const handleClose = () => appWindow.close();

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".titlebar-btn")) return;

    const now = Date.now();
    if (now - lastClickRef.current < DOUBLE_CLICK_MS) {
      lastClickRef.current = 0;
      handleToggleMaximize();
      return;
    }
    lastClickRef.current = now;
    appWindow.startDragging();
  };

  return (
    <div
      className="titlebar flex items-center justify-between select-none h-[32px] flex-shrink-0 bg-[#252525]/80 backdrop-blur-[40px] border-b border-macos-border"
      onMouseDown={handleMouseDown}
    >
      {/* Left: App name */}
      <div className="flex items-center px-[14px] h-full flex-1 min-w-0 pointer-events-none">
        <span className="text-[13px] font-medium text-macos-secondary tracking-wide truncate">
          onabreak
        </span>
      </div>

      {/* Right: Windows-style window controls */}
      <div className="flex items-center h-full titlebar-btn pointer-events-auto">
        <button
          onClick={handleMinimize}
          className="w-[46px] h-full flex items-center justify-center hover:bg-white/10 transition-colors"
          title="最小化"
        >
          <svg
            className="h-[11px] w-[11px] text-white/90"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 12 12"
            strokeWidth={1.15}
            strokeLinecap="round"
          >
            <path d="M2 6h8" />
          </svg>
        </button>
        <button
          onClick={handleToggleMaximize}
          className="w-[46px] h-full flex items-center justify-center hover:bg-white/10 transition-colors"
          title={isMaximized ? "还原" : "最大化"}
        >
          {isMaximized ? (
            <svg
              className="h-[11px] w-[11px] text-white/90"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 12 12"
              strokeWidth={1.15}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M 3 3 L 3 0.5 L 9 0.5 L 9 6.5 L 6.5 6.5" />
              <rect x="0.5" y="3" width="6" height="6" />
            </svg>
          ) : (
            <svg
              className="h-[11px] w-[11px] text-white/90"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 12 12"
              strokeWidth={1.15}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="1.5" y="1.5" width="9" height="9" />
            </svg>
          )}
        </button>
        <button
          onClick={handleClose}
          className="w-[46px] h-full flex items-center justify-center hover:bg-red-600/80 transition-colors"
          title="关闭"
        >
          <svg
            className="h-[11px] w-[11px] text-white/90"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 12 12"
            strokeWidth={1.15}
            strokeLinecap="round"
          >
            <path d="M3 3l6 6M9 3L3 9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
