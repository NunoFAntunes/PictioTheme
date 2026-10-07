import { DEFAULT_DECK_LANGUAGE, DeckLanguage } from '@pictiotheme/protocol';

/**
 * The language this browser's host last picked for a room, so their next room starts in it (a
 * per-viewer convenience). Storage can be unavailable, so every access is guarded.
 */

const STORAGE_KEY = 'pictiotheme.roomLanguage';

export function loadRoomLanguage(): DeckLanguage {
  try {
    const parsed = DeckLanguage.safeParse(localStorage.getItem(STORAGE_KEY));
    return parsed.success ? parsed.data : DEFAULT_DECK_LANGUAGE;
  } catch {
    return DEFAULT_DECK_LANGUAGE;
  }
}

export function saveRoomLanguage(language: DeckLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Not remembered; the room still changes.
  }
}
