import { SPELL_TUNING, type Team } from '@pictiotheme/protocol/tower';
import { useEffect } from 'react';
import { sendToRoom, useServerNow, type RoomView } from '../../../realtime';
import { SPELL_LABEL } from '../../../lib/spells';
import { CREW_NAME } from '../../../ui/CrewBadge';

const SLOTS = Array.from({ length: SPELL_TUNING.maxCharges }, (_, i) => i);
const KEYS: Record<string, number> = { Digit1: 0, Digit2: 1, Numpad1: 0, Numpad2: 1 };

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/**
 * A crew's spells (docs/tower/planning/power-ups.md), in its tower's header. Your crew's are
 * buttons, 1 and 2 on a keyboard, aimed at the other crew; theirs are there so you can see what's
 * coming. The drawer can't cast, and nobody can while the other tower is under a spell.
 */
export function SpellSlots({ view, team, mine }: { view: RoomView; team: Team; mine: boolean }) {
  const { charges } = view.crews[team];
  const target: Team = team === 'orange' ? 'teal' : 'orange';
  const drawing = view.crews[team].round?.drawerId === view.you;
  const busy = view.crews[target].spell !== null;
  const why = drawing
    ? 'The drawer can’t cast'
    : busy
      ? `${CREW_NAME[target]}’s tower is already under a spell`
      : null;
  const canCast = mine && why === null;

  useEffect(() => {
    if (!canCast) return;
    const onKey = (e: KeyboardEvent) => {
      const slot = KEYS[e.code];
      if (slot === undefined || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (charges[slot]) sendToRoom({ t: 'spell:cast', slot });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canCast, charges]);

  if (!view.settings.powers) return null;
  return (
    <div className="flex items-center gap-1" aria-label={`${CREW_NAME[team]} spells`}>
      {SLOTS.map((slot) => {
        const spell = charges[slot];
        if (!spell) {
          return (
            <span
              key={slot}
              aria-hidden="true"
              className="h-7 w-7 rounded-lg border-2 border-dashed border-cloud/25"
            />
          );
        }
        const label = SPELL_LABEL[spell];
        const title = `${label.icon} ${label.name}: ${label.effect}`;
        if (!mine) {
          return (
            <span
              key={slot}
              title={title}
              aria-label={label.name}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-dusk-800 text-base"
            >
              {label.icon}
            </span>
          );
        }
        return (
          <button
            key={slot}
            type="button"
            disabled={!canCast}
            title={why ? `${title} (${why})` : `${title}. Press ${slot + 1}`}
            aria-label={`Cast ${label.name} at ${CREW_NAME[target]} (${slot + 1})`}
            onClick={() => sendToRoom({ t: 'spell:cast', slot })}
            className="relative flex h-7 items-center gap-1 rounded-lg bg-sun px-1.5 text-base text-ink shadow-[0_2px_0_oklch(0.55_0.12_80)] enabled:hover:brightness-110 enabled:active:translate-y-0.5 disabled:opacity-45"
          >
            {label.icon}
            <span className="font-display text-[10px]">{slot + 1}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Over a tower under a spell: the warning while it's on its way, then how long it lasts. */
export function SpellBadge({ view, team }: { view: RoomView; team: Team }) {
  const now = useServerNow(200);
  const spell = view.crews[team].spell;
  if (!spell) return null;
  const label = SPELL_LABEL[spell.spell];
  const caster = view.players.find((p) => p.id === spell.casterId);
  const coming = now < spell.startsAt;
  const seconds = Math.max(0, Math.ceil((spell.endsAt - now) / 1000));
  const text = coming
    ? `${label.icon} ${caster?.name ?? 'Someone'} is casting ${label.name}!`
    : spell.spell === 'magpie'
      ? `${label.icon} A magpie is circling… ${seconds}s`
      : spell.spell === 'pigeon'
        ? `${label.icon} A pigeon is perched… ${seconds}s`
        : `${label.icon} ${label.name} ${seconds}s`;
  return (
    <div className="pointer-events-none absolute top-2 left-2 z-20 max-w-[55%]" role="status">
      <div
        className={`rounded-xl px-3 py-1 font-display text-sm shadow-xl ${coming ? 'animate-pulse bg-sun text-ink' : 'bg-ink/90 text-cloud'}`}
      >
        {text}
      </div>
    </div>
  );
}
