import { Stroke } from '@pictiotheme/protocol';
import { z } from 'zod';

/**
 * Drawings saved in the sandbox, kept in this browser only: a convenience for tuning, and the
 * source of new golden tests ("Copy JSON" → packages/doodle-shape/src/samples.ts). Storage can be
 * missing or full (private windows), so every access is guarded and failure means "nothing saved".
 */

const KEY = 'doodle-tower:sandbox-drawings';

export const SavedDrawing = z.object({ word: z.string().max(80), strokes: z.array(Stroke) });
export type SavedDrawing = z.infer<typeof SavedDrawing>;

export function loadSavedDrawings(): SavedDrawing[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = z.array(SavedDrawing).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function storeSavedDrawings(drawings: readonly SavedDrawing[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(drawings));
    return true;
  } catch {
    return false;
  }
}
