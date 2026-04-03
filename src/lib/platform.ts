export const IS_MAC = navigator.platform.includes("Mac");

export function getPrimaryShortcutModifierLabel(): string {
  return IS_MAC ? "Command" : "Ctrl";
}

export function isPrimaryShortcutModifierPressed(event: {
  ctrlKey: boolean;
  metaKey: boolean;
}): boolean {
  return IS_MAC ? event.metaKey : event.ctrlKey;
}

export function hasConflictingPrimaryShortcutModifier(event: {
  ctrlKey: boolean;
  metaKey: boolean;
}): boolean {
  return IS_MAC ? event.ctrlKey : event.metaKey;
}
