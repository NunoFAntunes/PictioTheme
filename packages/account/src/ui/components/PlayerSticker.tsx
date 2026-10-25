import type { CSSProperties } from 'react';
import { useEffect, useId } from 'react';
import { startAccount, useAccount } from '../../account-store';
import { accountKindOf, EMPTY_PROFILE } from '../../profile';
import { closeProfileEditor, openProfileEditor, useProfileEditorOpen } from '../editor';
import { IntroduceYourself } from './IntroduceYourself';
import { MARKER_BORDER, ProfileDialog } from './ProfileDialog';

/** Lopsided marker corners, as on DoodleWhirl's home page buttons. */
const WOBBLE = [
  'rounded-[0.7em_1.5em_0.9em_1.7em/1.1em_0.8em_1.2em_0.7em]',
  'rounded-[1.2em_0.8em_1.6em_0.6em/0.7em_1.1em_0.9em_1.2em]',
] as const;

const LOOKS = {
  home: {
    sticker: `${WOBBLE[1]} ${MARKER_BORDER} -rotate-2 bg-white py-1.5 pr-6 pl-[4.75rem] shadow-[3px_4px_0_var(--color-ink)] hover:shadow-[5px_6px_0_var(--color-ink)]`,
    doodle: '-top-11 -left-7 size-24',
    name: 'font-hand text-2xl',
  },
  room: {
    sticker: `${WOBBLE[0]} border-[2px_2.5px_3px_2px] border-ink -rotate-2 bg-pop-sun py-0.5 pr-5 pl-12 shadow-[2px_3px_0_var(--color-ink)] hover:shadow-[3px_4px_0_var(--color-ink)]`,
    doodle: '-top-4 -left-3 size-14',
    name: '',
  },
} as const;

/** A die-cut edge: the doodle reads as a sticker on any background. */
const DIE_CUT =
  '[filter:drop-shadow(2px_0_0_white)_drop-shadow(-2px_0_0_white)_drop-shadow(0_2px_0_white)_drop-shadow(0_-2px_0_white)_drop-shadow(1px_2px_0_var(--color-ink))]';

/**
 * Your "you" sticker, the same on the portal and in every game (decisions.md D13): your doodle
 * leans out of a lopsided marker sticker with your name on it ("Playing as guest" above it while
 * you're a guest), and a ✏️ on its corner says a click changes them. A click opens the profile
 * editor, which this sticker hosts (`openProfileEditor` opens it from elsewhere on the page).
 *
 * `home` is the white one for a home page; `room` is the smaller sun-yellow one for a room's
 * header, tagged YOU, with your name in `nameStyle`; `avatar` is just your doodle, for while a
 * match is on. `nudge` points an arrow at it asking you to introduce yourself. `fallbackAvatar`
 * is your game's stand-in until you draw yourself. `portalLink` puts a "← Games" chip before a
 * `home` sticker, back to the portal at `portalUrl`: for a game's home page only, since from a
 * room or a match it would take you out of the game. Styled with Tailwind (ui/theme.css).
 */
export function PlayerSticker({
  look = 'home',
  fallbackAvatar,
  nameStyle,
  nudge = false,
  portalUrl,
  portalLink = false,
}: {
  look?: 'home' | 'room' | 'avatar';
  fallbackAvatar: (name: string | null) => string;
  nameStyle?: CSSProperties;
  nudge?: boolean;
  portalUrl?: string;
  portalLink?: boolean;
}) {
  // Offline on a first visit there's no profile yet: you start with none, and name yourself.
  const profile = useAccount((s) => s.profile ?? (s.status === 'offline' ? EMPTY_PROFILE : null));
  const editing = useProfileEditorOpen();
  const nudgeId = useId();
  useEffect(() => startAccount(), []);
  // Leaving the page with it open (a client-side navigation) doesn't reopen it on the next.
  useEffect(() => closeProfileEditor, []);

  if (!profile) {
    return look === 'avatar' ? (
      <span className="block size-10" aria-busy="true" />
    ) : (
      <span className={`block h-12 w-44 opacity-60 ${LOOKS[look].sticker}`} aria-busy="true">
        <span className="sr-only">Loading your profile</span>
      </span>
    );
  }

  const kind = accountKindOf(profile);
  const name = profile.displayName;
  const avatar = profile.drawing ?? fallbackAvatar(name);
  const label =
    name === null
      ? 'Name yourself and draw yourself'
      : `Playing as ${name}: change name or drawing`;
  const editor = editing && (
    <ProfileDialog
      onClose={closeProfileEditor}
      fallback={fallbackAvatar(name)}
      portalUrl={portalUrl}
    />
  );

  if (look === 'avatar') {
    return (
      <>
        <button
          type="button"
          onClick={openProfileEditor}
          aria-label={label}
          title={name ?? undefined}
          className={`group relative grid size-10 place-items-center transition hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-dashed focus-visible:outline-ink ${DIE_CUT}`}
        >
          <img
            src={avatar}
            alt=""
            draggable={false}
            className="size-full object-contain motion-safe:group-hover:animate-boil"
          />
        </button>
        {editor}
      </>
    );
  }

  const styles = LOOKS[look];
  const tag =
    look === 'room'
      ? 'You'
      : kind === 'new'
        ? 'Who are you?'
        : kind === 'user'
          ? 'Playing as'
          : 'Playing as guest';

  return (
    <div className="flex items-start gap-3">
      <div className="relative flex items-center">
        {look === 'home' && portalLink && portalUrl && <PortalLink href={portalUrl} />}
        <button
          type="button"
          onClick={openProfileEditor}
          aria-label={label}
          aria-describedby={nudge ? nudgeId : undefined}
          title="Change your name or draw yourself"
          className={`group relative flex max-w-[16rem] items-center text-ink transition hover:-translate-y-0.5 hover:rotate-0 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-dashed focus-visible:outline-ink active:translate-y-0.5 active:shadow-[1px_1px_0_var(--color-ink)] ${styles.sticker}`}
        >
          {/* Your character, leaning out of the sticker. */}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute rotate-6 transition-transform group-hover:-rotate-3 group-hover:scale-110 ${DIE_CUT} ${styles.doodle}`}
          >
            <span className="block size-full motion-safe:animate-sway">
              <img
                src={avatar}
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
              className={`max-w-full truncate pt-0.5 pb-px [-webkit-text-stroke:0.035em_currentColor] ${styles.name}`}
              style={nameStyle}
            >
              {name ?? 'Name yourself'}
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
      </div>
      {nudge && <IntroduceYourself id={nudgeId} />}
      {editor}
    </div>
  );
}

/**
 * Back to the games portal, beside a home page's sticker: the same marker family, plainer (no
 * doodle, no ✏️) so it reads as the lesser control. On a phone there's no room beside the
 * sticker, so it hangs under it instead. "Games" is the portal's placeholder name
 * (apps/portal/src/site.ts, SITE_NAME): rename both together.
 */
function PortalLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      title="See all the games"
      // Clear of the doodle leaning out of the sticker's top-left corner.
      className={`flex shrink-0 items-center gap-1 max-sm:absolute max-sm:top-full max-sm:left-0 max-sm:mt-3 sm:mr-9 border-[2px_2.5px_3px_2px] border-ink bg-paper px-2.5 py-1 font-hand text-xl leading-none text-ink no-underline shadow-[2px_3px_0_var(--color-ink)] transition rotate-[1.5deg] hover:-translate-y-0.5 hover:rotate-0 hover:shadow-[3px_4px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-dashed focus-visible:outline-ink active:translate-y-0.5 active:shadow-[1px_1px_0_var(--color-ink)] ${WOBBLE[0]}`}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0">
        <path
          d="M10.5 2.5 4.5 8l6 5.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Games
    </a>
  );
}
