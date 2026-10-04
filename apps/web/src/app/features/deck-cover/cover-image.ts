import { DECK_COVER_HEIGHT_PX, DECK_COVER_WIDTH_PX, DeckCoverImage } from '@pictiotheme/protocol';

/** Turns the cover pad into the PNG the server stores (DECK_COVER_* size, white background). */

/** The drawing as a PNG data URL, or null if it can't be encoded within the size limit. */
export function drawingToCover(source: HTMLCanvasElement): DeckCoverImage | null {
  const canvas = document.createElement('canvas');
  canvas.width = DECK_COVER_WIDTH_PX;
  canvas.height = DECK_COVER_HEIGHT_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, DECK_COVER_WIDTH_PX, DECK_COVER_HEIGHT_PX);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, DECK_COVER_WIDTH_PX, DECK_COVER_HEIGHT_PX);
  const parsed = DeckCoverImage.safeParse(canvas.toDataURL('image/png'));
  return parsed.success ? parsed.data : null;
}

const DEFAULT_COLOURS = [
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#16a34a',
  '#0891b2',
  '#2563eb',
  '#9333ea',
];

/** The default cover's colour: the same title always gets the same colour. */
export function defaultCoverColour(title: string): string {
  let hash = 0;
  for (const ch of title) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return DEFAULT_COLOURS[hash % DEFAULT_COLOURS.length] ?? '#7c3aed';
}

/**
 * The default cover's look, for decks without a drawing: a colour from the title with light
 * diagonal stripes. Used by `DeckCover` and by the card backs while a drawer chooses.
 */
export function defaultCoverStyle(title: string): {
  backgroundColor: string;
  backgroundImage: string;
} {
  return {
    backgroundColor: defaultCoverColour(title),
    backgroundImage:
      'repeating-linear-gradient(45deg, rgb(255 255 255 / 0.12) 0 6px, transparent 6px 14px)',
  };
}
