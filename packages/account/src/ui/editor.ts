import { useSyncExternalStore } from 'react';

/**
 * Whether the profile editor is open. The page's "you" sticker shows it; anything else on the page
 * (a game's "draw yourself" prompt, a way in that needs a name) opens it with `openProfileEditor`.
 */
let open = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (open === next) return;
  open = next;
  for (const listener of listeners) listener();
}

export function openProfileEditor(): void {
  set(true);
}

export function closeProfileEditor(): void {
  set(false);
}

export function useProfileEditorOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => open,
    () => false,
  );
}
