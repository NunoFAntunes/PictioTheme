import { accountKindOf, useAccount } from '@pictiotheme/account';
import { useId, useState, type CSSProperties } from 'react';
import { PORTAL_URL } from '../../../lib/portal';
import type { Identity } from '../identity-store';
import { MARKER_BORDER, WOBBLE } from '../../../ui/hand-drawn';
import { PaperDialog } from '../../../ui/PaperDialog';
import { IdentityForm } from './IdentityForm';
import { IntroduceYourself } from './IntroduceYourself';

/**
 * Your "you" sticker (screens.md §1 and §4), DoodleWhirl's account widget (decisions.md D13): your
 * doodle, frameless like in the player list, leans out of a lopsided marker sticker with your name
 * on it, and a ✏️ on its corner opens the name and drawing editor. The name and drawing are your
 * profile in every game, which the editor says, with a link to all of them. On the home page it's
 * white and says "Playing as" (or "Playing as guest"); `compact` is the room header's sun-yellow
 * one, with a YOU tag and your name in `nameStyle` (the hand the player list writes it in);
 * `avatarOnly` is just your doodle, small, while a match is on. `nudge` points an arrow at it
 * asking you to introduce yourself. `onSaved` gets the saved identity.
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
  avatarOnly = false,
  nameStyle,
  nudge = false,
  onSaved,
}: {
  identity: Identity;
  compact?: boolean;
  avatarOnly?: boolean;
  nameStyle?: CSSProperties;
  nudge?: boolean;
  onSaved?: (identity: Identity) => void;
}) {
  const [open, setOpen] = useState(false);
  const nudgeId = useId();
  const look = compact ? LOOKS.room : LOOKS.home;
  const guest = useAccount((s) => s.profile !== null && accountKindOf(s.profile) !== 'user');
  const tag = compact ? look.tag : guest ? 'Playing as guest' : look.tag;

  const editor = (
    <PaperDialog
      open={open}
      guarded
      onClose={() => setOpen(false)}
      className="w-[52rem]"
      title="Your name and avatar"
    >
      {/* Only while open, so the page never has a second name field or pad. */}
      {open && (
        <>
          <IdentityForm
            submitLabel="Save"
            framed={false}
            onSaved={onSaved}
            onDone={() => setOpen(false)}
          />
          <p className="mt-3 text-sm text-zinc-500">
            Your name and drawing go with you to every game.{' '}
            <a href={PORTAL_URL} className="font-semibold text-ink underline">
              See all the games
            </a>
          </p>
        </>
      )}
    </PaperDialog>
  );

  if (avatarOnly) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Playing as ${identity.displayName}: change name or drawing`}
          title={identity.displayName}
          className={`group relative grid size-10 place-items-center transition hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-dashed focus-visible:outline-ink ${DIE_CUT}`}
        >
          <img
            src={identity.avatar}
            alt=""
            draggable={false}
            className="size-full object-contain motion-safe:group-hover:animate-boil"
          />
        </button>
        {editor}
      </>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
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
            {tag}
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
      {editor}
    </div>
  );
}
