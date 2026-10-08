/*
 * The room's frame, shared by the real room (RoomPage, RoomHeader) and the empty one shown before
 * it (routes/room/RoomShell): the logo, the sheet and the guess column are where the room will put
 * them from the very first frame, so entering from the home page morphs into them (global.css).
 */

import { WOBBLE } from './hand-drawn';

/** Tall enough for the "you" sticker, so the logo sits at the same height in every state. */
export const HEADER = 'flex min-h-16 flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2';

/** The sheet of paper the players and the board are on, lying on the desk like the home page's. */
export const SHEET =
  'rounded-sm bg-paper text-zinc-900 shadow-[0_2px_0_rgb(0_0_0/0.06),0_24px_48px_-24px_rgb(0_0_0/0.45)] scheme-light [view-transition-name:sheet]';

/** A smaller sheet beside it for the guesses, taped to the desk. */
export const NOTE =
  'relative rounded-sm bg-paper text-zinc-900 shadow-[0_2px_0_rgb(0_0_0/0.06),0_16px_32px_-20px_rgb(0_0_0/0.45)] scheme-light';

/**
 * The strip of paper under the guesses that you write your guess on, a little apart from them.
 * The empty room (RoomShell) lays one down too, so the guesses' note keeps its height.
 */
export const GUESS_STRIP =
  'relative min-h-14 shrink-0 rounded-sm bg-paper text-zinc-900 shadow-[0_2px_0_rgb(0_0_0/0.06),0_12px_24px_-16px_rgb(0_0_0/0.5)] scheme-light';

/** A panel on the sheet (deck library, house rules), outlined in ink like the logo's stickers. */
export const PANEL =
  'rounded-2xl border-2 border-ink bg-white p-4 shadow-[3px_3px_0_var(--color-ink)] dark:border-zinc-600 dark:bg-zinc-950 dark:shadow-none';

/** A panel's heading, in the logo's font. */
export const PANEL_HEADING = 'font-logo text-xl font-normal text-ink dark:text-zinc-100';

/**
 * A button in the header (the host's controls), a sticker cut out by hand like the "you" pill
 * beside it: paper, a lopsided marker outline in the logo's font, lifting and straightening when
 * you point at it. Paper stays light on the dark desk too. Pick a shape and tilt with `sticker()`.
 */
export const STICKER_BUTTON =
  'inline-flex items-center gap-1.5 border-ink border-[2px_2.5px_3px_2px] bg-paper px-3 py-1 font-logo text-base leading-tight font-normal text-ink shadow-[2px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 hover:rotate-0 hover:shadow-[3px_4px_0_var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashed focus-visible:outline-ink active:translate-y-0.5 active:shadow-[1px_1px_0_var(--color-ink)] disabled:translate-y-0 disabled:rotate-0 disabled:opacity-40 disabled:shadow-none aria-expanded:translate-y-0.5 aria-expanded:shadow-[1px_1px_0_var(--color-ink)] pointer-coarse:min-h-11';

const TILTS = ['-rotate-2', 'rotate-1', '-rotate-1', 'rotate-2'] as const;

/** The `n`th header sticker: its own lopsided shape and tilt, so no two neighbours match. */
export function sticker(n: number): string {
  return `${STICKER_BUTTON} ${WOBBLE[n % WOBBLE.length]} ${TILTS[n % TILTS.length]}`;
}
