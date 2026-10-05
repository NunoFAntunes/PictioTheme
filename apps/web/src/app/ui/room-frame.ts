/*
 * The room's frame, shared by the real room (RoomPage, RoomHeader) and the empty one shown before
 * it (routes/room/RoomShell): the logo, the sheet and the guess column are where the room will put
 * them from the very first frame, so entering from the home page morphs into them (global.css).
 */

/** Tall enough for the "you" sticker, so the logo sits at the same height in every state. */
export const HEADER = 'flex min-h-16 flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2';

/** The sheet of paper the players and the board are on, lying on the desk like the home page's. */
export const SHEET =
  'rounded-sm bg-paper text-zinc-900 shadow-[0_2px_0_rgb(0_0_0/0.06),0_24px_48px_-24px_rgb(0_0_0/0.45)] scheme-light [view-transition-name:sheet]';

/** A smaller sheet beside it for the guesses, taped to the desk. */
export const NOTE =
  'relative rounded-sm bg-paper text-zinc-900 shadow-[0_2px_0_rgb(0_0_0/0.06),0_16px_32px_-20px_rgb(0_0_0/0.45)] scheme-light';

/** A panel on the sheet (deck library, house rules), outlined in ink like the logo's stickers. */
export const PANEL =
  'rounded-2xl border-2 border-ink bg-white p-4 shadow-[3px_3px_0_var(--color-ink)] dark:border-zinc-600 dark:bg-zinc-950 dark:shadow-none';

/** A panel's heading, in the logo's font. */
export const PANEL_HEADING = 'font-logo text-xl font-normal text-ink dark:text-zinc-100';

/**
 * A button in the header (the host's controls), a sticker like the "you" pill beside it: paper,
 * outlined in ink, lifting when you point at it. Paper stays light on the dark desk too.
 */
export const STICKER_BUTTON =
  'inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-paper px-3 py-1 text-sm font-semibold text-ink shadow-[2px_2px_0_var(--color-ink)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:translate-y-0 active:shadow-none disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none aria-expanded:translate-y-0 aria-expanded:shadow-none pointer-coarse:min-h-11';
