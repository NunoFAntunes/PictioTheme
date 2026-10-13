import { MAX_PLAYERS_RANGE } from '@pictiotheme/protocol';
import { useState, type KeyboardEvent } from 'react';
import { sendToRoom } from '../../../realtime';
import { WOBBLE } from '../../../ui/hand-drawn';
import { ChevronIcon, PersonIcon } from '../../../ui/ScribbleIcons';

/**
 * How many can join, beside the public/private switch: a doodled person and the number, with
 * drawn arrows to raise or lower it. The host sets it (arrows, or ↑/↓ on the focused number);
 * everyone else just sees it.
 */
export function PlayerLimit({
  maxPlayers: inRoom,
  editable,
}: {
  maxPlayers: number;
  editable: boolean;
}) {
  const { min, max } = MAX_PLAYERS_RANGE;
  // What the host last set, ahead of the room's echo, so quick presses each count; back in step
  // whenever the room's number changes.
  const [maxPlayers, setMaxPlayers] = useState(inRoom);
  const [synced, setSynced] = useState(inRoom);
  if (inRoom !== synced) {
    setSynced(inRoom);
    setMaxPlayers(inRoom);
  }
  const set = (n: number) => {
    const next = Math.min(max, Math.max(min, n));
    if (next === maxPlayers) return;
    setMaxPlayers(next);
    sendToRoom({ t: 'room:settings', settings: { maxPlayers: next } });
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const to = {
      ArrowUp: maxPlayers + 1,
      ArrowRight: maxPlayers + 1,
      ArrowDown: maxPlayers - 1,
      ArrowLeft: maxPlayers - 1,
      Home: min,
      End: max,
    }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    set(to);
  };
  const hint = `Up to ${maxPlayers} players`;
  const arrow =
    'grid h-4 w-6 place-items-center rounded text-ink transition enabled:hover:text-pop-purple enabled:active:scale-90 disabled:opacity-25';

  return (
    <div
      title={hint}
      className={`inline-flex shrink-0 items-center gap-1 ${WOBBLE[0]} border-[2.5px_3px_3.5px_2.5px] border-ink bg-paper py-1 pr-1.5 pl-1.5 shadow-[2px_3px_0_var(--color-ink)]`}
    >
      <PersonIcon className="size-7 -rotate-3" />
      <span
        role={editable ? 'spinbutton' : undefined}
        tabIndex={editable ? 0 : undefined}
        aria-label="Max players"
        aria-valuemin={editable ? min : undefined}
        aria-valuemax={editable ? max : undefined}
        aria-valuenow={editable ? maxPlayers : undefined}
        aria-valuetext={hint}
        onKeyDown={editable ? onKeyDown : undefined}
        className="min-w-[2ch] rounded text-center font-logo text-xl leading-none text-ink tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-dashed"
      >
        {maxPlayers}
      </span>
      {editable && (
        <span className="flex flex-col">
          <button
            type="button"
            tabIndex={-1}
            aria-label="More players"
            disabled={maxPlayers >= max}
            onClick={() => set(maxPlayers + 1)}
            className={arrow}
          >
            <ChevronIcon className="h-2.5 w-4" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Fewer players"
            disabled={maxPlayers <= min}
            onClick={() => set(maxPlayers - 1)}
            className={arrow}
          >
            <ChevronIcon className="h-2.5 w-4 rotate-180" />
          </button>
        </span>
      )}
    </div>
  );
}
