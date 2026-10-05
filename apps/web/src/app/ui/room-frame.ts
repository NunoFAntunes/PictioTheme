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
