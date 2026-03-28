import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "../stores/chatStore";

let prevUnread = -1;

function totalUnreadMessages(counts: Record<number, number>) {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

function updateTaskbarBadge() {
  const state = useChatStore.getState();
  const unreadCount = totalUnreadMessages(state.unreadSessionCounts);

  if (unreadCount === prevUnread) return;
  prevUnread = unreadCount;

  invoke("set_taskbar_badge", { unread: unreadCount }).catch(
    (err) => console.warn("[taskbarBadge] set_taskbar_badge failed:", err),
  );
}

export function initTaskbarBadge() {
  useChatStore.subscribe((state) => {
    void state.unreadSessionCounts;
    updateTaskbarBadge();
  });
}
