import { useId, useRef, useState, type CSSProperties } from 'react';
import type { Identity } from '../../../lib/identity';
import { MARKER_BORDER, WOBBLE } from '../../../ui/hand-drawn';
import { IdentityForm } from './IdentityForm';
import { IntroduceYourself } from './IntroduceYourself';

/**
 * Your "you" sticker (screens.md §1 and §4): your doodle, frameless like in the player list, leans
 * out of a lopsided marker sticker with your name on it, and a ✏️ on its corner opens the name and
 * drawing editor. On the home page it's white and says "Playing as"; `compact` is the room header's
 * sun-yellow one, with a YOU tag and your name in `nameStyle` (the hand the player list writes it
 * in). `nudge` points an arrow at it asking you to introduce yourself. `onSaved` gets the saved
 * identity.
 */

const LOOKS = {
  home: {
    tag: 'Playing as',
    sticker: `${WOBBLE[2]} ${MARKER_BORDER} -rotate-2 bg-white py-1.5 pr-6 pl-[4.75rem] shadow-[3px_4px_0_var(--color-ink)] hover:shadow-[5px_6px_0_var(--color-ink)]`,
    doodle: '-top-11 -left-7 size-24',
    name: 'font-hand text-2xl',
  },
  room: {
    tag: 'You',
    sticker: `${WOBBLE[1]} border-[2px_2.5px_3px_2px] border-ink -rotate-2 bg-pop-sun py-0.5 pr-5 pl-12 shadow-[2px_3px_0_var(--color-ink)] hover:shadow-[3px_4px_0_var(--color-ink)]`,
    doodle: '-top-4 -left-3 size-14',
    name: '',
  },
} as const;

/** A die-cut edge: the doodle reads as a sticker on any background, the dark desk included. */
const DIE_CUT =
  '[filter:drop-shadow(2px_0_0_white)_drop-shadow(-2px_0_0_white)_drop-shadow(0_2px_0_white)_drop-shadow(0_-2px_0_white)_drop-shadow(1px_2px_0_var(--color-ink))]';

export function IdentityChip({
  identity,
  compact = false,
  nameStyle,
  nudge = false,
  onSaved,
}: {
  identity: Identity;
  compact?: boolean;
  nameStyle?: CSSProperties;
  nudge?: boolean;
  onSaved?: (identity: Identity) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // The form only exists while open, so the page never has a second name field or pad.
  const [open, setOpen] = useState(false);
  const nudgeId = useId();
  const look = compact ? LOOKS.room : LOOKS.home;

  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
        aria-label={`Playing as ${identity.displayName}: change name or drawing`}
        aria-describedby={nudge ? nudgeId : undefined}
        className={`group relative flex max-w-[16rem] items-center text-ink transition hover:-translate-y-0.5 hover:rotate-0 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-dashed focus-visible:outline-ink active:translate-y-0.5 active:shadow-[1px_1px_0_var(--color-ink)] ${look.sticker}`}
        title="Change your name or draw your avatar"
      >
        {/* Your character, leaning out of the sticker: it boils when you point at it. */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute rotate-6 transition-transform group-hover:-rotate-3 group-hover:scale-110 ${DIE_CUT} ${look.doodle}`}
        >
          <span className="block size-full motion-safe:animate-sway">
            <img
              src={identity.avatar}
              alt=""
              draggable={false}
              className="size-full object-contain motion-safe:group-hover:animate-boil"
            />
          </span>
        </span>
        <span className="flex min-w-0 flex-col items-start leading-none">
          <span className="-rotate-1 rounded-sm bg-ink px-1 py-px text-[0.55rem] font-bold tracking-widest text-white uppercase">
            {look.tag}
          </span>
          <span
            className={`max-w-full truncate pt-0.5 pb-px [-webkit-text-stroke:0.035em_currentColor] ${look.name}`}
            style={nameStyle}
          >
            {identity.displayName}
          </span>
        </span>
        {/* The ✏️ sticker on the corner: what clicking does. */}
        <span
          aria-hidden="true"
          className="absolute -top-3 -right-3 grid size-7 rotate-12 place-items-center rounded-full border-2 border-ink bg-white text-sm shadow-[1px_2px_0_var(--color-ink)] transition-transform group-hover:-rotate-12 group-hover:scale-110"
        >
          ✏️
        </span>
      </button>
      {nudge && <IntroduceYourself id={nudgeId} />}
      {/* data-paper: always light, like the paper it opens over. */}
      <dialog
        ref={dialog}
        data-paper
        aria-label="Your name and avatar"
        onClose={() => setOpen(false)}
        className="m-auto rounded-2xl bg-white p-0 text-ink shadow-xl backdrop:bg-ink/40"
        onClick={(e) => {
          // A click on the backdrop (the dialog element itself, outside the form) closes it.
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        {open && (
          <IdentityForm
            submitLabel="Save"
            onSaved={onSaved}
            onDone={() => dialog.current?.close()}
          />
        )}
      </dialog>
    </div>
  );
}
