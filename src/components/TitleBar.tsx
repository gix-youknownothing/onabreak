import { useEffect, useState, useCallback, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();
const DOUBLE_CLICK_MS = 300;
const IS_MAC = navigator.platform.includes("Mac");
const MACOS_CONTROLS_WIDTH = 78;

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
      {IS_MAC ? (
        <>
          <div
            className="titlebar-btn pointer-events-auto flex items-center gap-2 px-3"
            style={{ width: `${MACOS_CONTROLS_WIDTH}px` }}
          >
            <button
              onClick={handleClose}
              className="group flex h-3 w-3 items-center justify-center rounded-full bg-[#ff5f57] shadow-[inset_0_0.5px_0_rgba(255,255,255,0.32)]"
              title="关闭"
            >
              <svg
                className="h-[7px] w-[7px] text-black/55 opacity-80 transition-opacity group-hover:opacity-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 12 12"
                strokeWidth={1.5}
                strokeLinecap="round"
              >
                <path d="M3.25 3.25 8.75 8.75M8.75 3.25 3.25 8.75" />
              </svg>
            </button>
            <button
              onClick={handleMinimize}
              className="group flex h-3 w-3 items-center justify-center rounded-full bg-[#ffbd2f] shadow-[inset_0_0.5px_0_rgba(255,255,255,0.32)]"
              title="最小化"
            >
              <svg
                className="h-[7px] w-[7px] text-black/55 opacity-80 transition-opacity group-hover:opacity-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 12 12"
                strokeWidth={1.6}
                strokeLinecap="round"
              >
                <path d="M3 6h6" />
              </svg>
            </button>
            <button
              onClick={handleToggleMaximize}
              className="group flex h-3 w-3 items-center justify-center rounded-full bg-[#28c840] shadow-[inset_0_0.5px_0_rgba(255,255,255,0.32)]"
              title={isMaximized ? "还原" : "最大化"}
            >
              <svg
                className="h-[7px] w-[7px] text-black/55 opacity-80 transition-opacity group-hover:opacity-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 12 12"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {isMaximized ? (
                  <path d="M3.5 5.5V3.5h3M8.5 6.5v2h-3M8.5 6.5V8.5M8.5 6.5h-2M3.5 5.5v2h3M3.5 5.5h2" />
                ) : (
                  <path d="M6 3v6M3 6h6" />
                )}
              </svg>
            </button>
          </div>

          <div className="flex h-full flex-1 items-center justify-center px-3 min-w-0 pointer-events-none">
            <span className="truncate text-[13px] font-medium tracking-wide text-macos-secondary">
              onabreak
            </span>
          </div>

          <div
            aria-hidden="true"
            className="h-full flex-shrink-0"
            style={{ width: `${MACOS_CONTROLS_WIDTH}px` }}
          />
        </>
      ) : (
        <>
          <div className="flex items-center px-[14px] h-full flex-1 min-w-0 pointer-events-none">
            <span className="text-[13px] font-medium text-macos-secondary tracking-wide truncate">
              onabreak
            </span>
          </div>

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
        </>
      )}
    </div>
  );
}
