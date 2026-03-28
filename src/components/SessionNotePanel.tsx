import { useState, useRef, useCallback, useEffect } from "react";
import { useChatStore, type Session } from "../stores/chatStore";

interface SessionNotePanelProps {
  session: Session;
}

const MIN_WIDTH = 240;
const MIN_HEIGHT = 120;
const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 400;

export default function SessionNotePanel({ session }: SessionNotePanelProps) {
  const { updateSessionNotes } = useChatStore();

  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(session.notes || "");
  const [size, setSize] = useState({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);

  // Position is fully in refs to avoid stale-closure issues during resize
  const posRef = useRef({ x: 0, y: 0 });
  // Force re-render on drag to update style
  const [, forceUpdate] = useState(0);

  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset notes when session changes
  useEffect(() => {
    setNotes(session.notes || "");
  }, [session.id, session.notes]);

  const handleNotesChange = useCallback(
    (value: string) => {
      setNotes(value);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateSessionNotes(session.id, value);
      }, 500);
    },
    [session.id, updateSessionNotes],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragOffset.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y };
      setDragging(true);
    },
    [],
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      posRef.current = {
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      };
      forceUpdate((n) => n + 1);
    };
    const handleUp = () => setDragging(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging]);

  // Resize handlers
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        w: size.w,
        h: size.h,
      };
      setResizing(true);
    },
    [size],
  );

  useEffect(() => {
    if (!resizing) return;

    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      // Drag left (negative dx) → wider, drag right → narrower
      const newW = Math.max(MIN_WIDTH, resizeStart.current.w - dx);
      const newH = Math.max(MIN_HEIGHT, resizeStart.current.h + dy);
      setSize({ w: newW, h: newH });
      forceUpdate((n) => n + 1);
    };
    const handleUp = () => setResizing(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [resizing]);

  const right = 16 - posRef.current.x;
  const top = 16 + posRef.current.y;

  // Collapsed — small toggle button
  if (!expanded) {
    return (
      <div
        className="absolute z-20 cursor-grab select-none"
        style={{ right, top }}
        onMouseDown={handleDragStart}
      >
        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-terminal-800/95 border border-terminal-600 rounded-lg text-xs font-mono text-terminal-300 hover:text-terminal-100 hover:border-terminal-500 transition-colors"
          onClick={() => setExpanded(true)}
          onMouseDown={(e) => e.stopPropagation()}
          title="展开笔记"
        >
          <svg className="w-3.5 h-3.5 text-terminal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          笔记
        </button>
      </div>
    );
  }

  // Expanded panel
  return (
    <div
      className="absolute z-20 flex flex-col bg-terminal-800/95 border border-terminal-600 rounded-lg overflow-hidden"
      style={{
        right,
        top,
        width: size.w,
        height: size.h,
      }}
    >
      {/* Header bar — drag handle + toggle */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-grab select-none flex-shrink-0"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-terminal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <span className="text-xs font-mono text-terminal-300">笔记</span>
        </div>
        <button
          className="w-5 h-5 flex items-center justify-center rounded text-terminal-400 hover:text-terminal-100 hover:bg-terminal-700 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          title="收起"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0">
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="在此记录思路、TODO、关键信息..."
          className="w-full h-full bg-transparent p-3 text-sm font-mono text-terminal-200 placeholder-terminal-600 resize-none outline-none"
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>

      {/* Resize handle — bottom-left corner, expands left-down */}
      <div
        className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize"
        onMouseDown={handleResizeStart}
      >
        <svg className="w-3 h-3 text-terminal-600 absolute bottom-0.5 left-0.5" viewBox="0 0 12 12">
          <path d="M2 2L10 10M2 6L6 10M2 10L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
