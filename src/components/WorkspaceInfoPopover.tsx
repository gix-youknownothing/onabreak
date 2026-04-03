import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

interface WorkspaceInspectResult {
  isGitRepo: boolean;
  branch: string | null;
  resolvedWorkDir: string;
}

interface WorkspaceInfoPopoverProps {
  anchorEl: HTMLElement;
  inspectResult?: WorkspaceInspectResult;
  isLoading: boolean;
  error?: string;
  onRequestClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const POPOVER_WIDTH = 280;
const VIEWPORT_GUTTER = 12;
const APPROX_POPOVER_HEIGHT = 132;

function getPopoverStyle(anchorEl: HTMLElement): CSSProperties {
  const rect = anchorEl.getBoundingClientRect();
  const left = Math.min(
    rect.right + 8,
    window.innerWidth - POPOVER_WIDTH - VIEWPORT_GUTTER,
  );
  const top = Math.min(
    Math.max(VIEWPORT_GUTTER, rect.top - 10),
    Math.max(VIEWPORT_GUTTER, window.innerHeight - APPROX_POPOVER_HEIGHT - VIEWPORT_GUTTER),
  );

  return {
    position: "fixed",
    top,
    left,
    width: POPOVER_WIDTH,
  };
}

export default function WorkspaceInfoPopover({
  anchorEl,
  inspectResult,
  isLoading,
  error,
  onRequestClose,
  onMouseEnter,
  onMouseLeave,
}: WorkspaceInfoPopoverProps) {
  const [style, setStyle] = useState(() => getPopoverStyle(anchorEl));
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePosition = () => setStyle(getPopoverStyle(anchorEl));

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorEl]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !anchorEl.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        onRequestClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onRequestClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [anchorEl, onRequestClose]);

  return createPortal(
    <div
      ref={popoverRef}
      style={style}
      role="dialog"
      aria-label="Workspace 详情"
      className="z-[9999] overflow-hidden rounded-xl border border-macos-border bg-macos-card/95 shadow-lg shadow-black/30 backdrop-blur-xl msg-card-enter"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="px-3 py-2.5">
        <div className="space-y-2.5 text-[12px] text-macos-secondary">
          {isLoading ? (
            <div className="rounded-lg bg-macos-elevated/60 px-3 py-2 text-macos-tertiary">
              读取中...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-macos-red/20 bg-macos-red/8 px-3 py-2 text-macos-red">
              {error}
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2">
                <div className="shrink-0 text-macos-tertiary">路径:</div>
                <div className="break-all font-semibold text-macos-text">
                  {inspectResult?.resolvedWorkDir ?? "-"}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="shrink-0 text-macos-tertiary">Git 分支:</div>
                <div className="break-all font-semibold text-macos-text">
                  {inspectResult?.isGitRepo
                    ? (inspectResult.branch ?? "-")
                    : "不是 Git 仓库"}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
