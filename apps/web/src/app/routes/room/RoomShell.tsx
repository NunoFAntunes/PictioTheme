import type { ReactNode } from 'react';
import { StickerLogo } from '../../ui/StickerLogo';
import { GUESS_STRIP, HEADER, NOTE, SHEET } from '../../ui/room-frame';

/** Wide screens (laptops, tablets in landscape): the sheet · guesses. Matches `lg:` (1024 px). */
export const WIDE = '(min-width: 1024px)';

/** A strip of tape holding a sheet down by its top-left corner (clear of the "you" sticker). */
export function Tape() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-1 -left-3 h-4 w-12 -rotate-45 bg-pop-sun/60 shadow-sm"
    />
  );
}

/** The faint red margin line the players stand behind. */
export function MarginLine({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`absolute inset-y-0 w-px bg-pop-tomato/30 ${className}`} />
  );
}

/**
 * The room before it's there (app.astro's first frame, then joining, or why it couldn't open):
 * the logo, an empty sheet with a message, an empty guess column and the strip under it.
 */
export function RoomShell({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className={HEADER}>
        <StickerLogo />
      </header>
      <div className="flex min-h-0 flex-1 flex-col p-2 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-3 lg:px-3 lg:pt-0 lg:pb-3">
        <main data-paper className={`relative flex min-h-0 flex-1 overflow-hidden ${SHEET}`}>
          <MarginLine className="left-44 hidden lg:block" />
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center lg:pl-48">
            <h1 className="text-2xl font-semibold">{title}</h1>
            {children}
          </div>
        </main>
        <aside aria-hidden="true" className="hidden flex-col gap-4 lg:flex">
          <div data-paper className={`flex-1 ${NOTE}`}>
            <Tape />
          </div>
          <div data-paper className={GUESS_STRIP} />
        </aside>
      </div>
    </div>
  );
}
