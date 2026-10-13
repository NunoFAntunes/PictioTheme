import { rushWindowMs } from '@pictiotheme/game-core';
import type { RoomSettings } from '@pictiotheme/protocol';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { sendToRoom, type RoomView } from '../../../realtime';
import { DOUBLE_LOOP, loopAt, MarkerLoop } from '../../../ui/MarkerLoop';
import { playSound } from '../../sound';
import { CARD_POOLS, cardPoolOf, cardPoolSettings } from '../card-pool';
import { lengthLabel, maxMatchMinutes, paceOf, PACES } from '../match-length';
import { LengthRuler } from './LengthRuler';

/**
 * The house rules, as three quick choices: how long the match runs (a preset, or Custom: the
 * exact rounds and draw time, set on a ruler, LengthRuler), which cards come up, and which rules
 * are on (ticked boxes). Editable by the host; everyone else sees them read-only. The deck is
 * chosen beside them (WaitingRoom); the room's name, public/private and size sit on top
 * (RoomTitle).
 *
 * They're written on a notepad (WaitingRoom's Notebook): a choice is circled in marker, and a rule
 * is ticked. The loop and the tick draw themselves when the setting changes, so the players
 * watch the host's pen too.
 */

/** The on/off rules, each a tick box: what it's called, whether it's on, and what turning it on does. */
const RULES: {
  id: string;
  icon: string;
  label: string;
  on: (s: RoomSettings) => boolean;
  set: (on: boolean) => Partial<RoomSettings>;
  hint: (s: RoomSettings) => string;
}[] = [
  {
    id: 'rush',
    icon: '⚡',
    label: 'Rush',
    on: (s) => s.rush,
    set: (rush) => ({ rush }),
    hint: (s) =>
      `After the first correct guess, ${rushWindowMs(s.drawSeconds * 1000) / 1000}s left and points drain`,
  },
  {
    id: 'hints',
    icon: '💡',
    label: 'Hints',
    on: (s) => s.hints,
    set: (hints) => ({ hints }),
    hint: () => 'A few letters show from ½ of the time on',
  },
  {
    id: 'guesses',
    icon: '👀',
    label: 'Show guesses',
    on: (s) => s.guessVisibility === 'show',
    set: (on) => ({ guessVisibility: on ? 'show' : 'hide' }),
    hint: () => 'Everyone sees the wrong guesses, not just their own',
  },
  {
    id: 'choice',
    icon: '🃏',
    label: 'Pick from 3',
    on: (s) => s.wordChoice === 3,
    set: (on) => ({ wordChoice: on ? 3 : 1 }),
    hint: () => 'The drawer picks one of 3 cards, not just the first',
  },
];

/** A hand-drawn tick box (26×26) and the tick that goes in it, overshooting the box. */
const BOX =
  'M4 5C9 3.5 17 4 21.5 4.5 21.8 10 21.2 16 20.8 21.5 14 21.8 8 21.2 3.6 20.8 3.2 14 3.5 9 4.6 3.5';
const TICK = 'M6.5 12.5C8.5 14.5 10 17 11.5 19.5 14.5 12.5 18.5 6 25.5 0.5';

/** A little pop when a setting changes (for everyone in the room), as the pen marks it. */
function useMarkSound(value: unknown) {
  const last = useRef(value);
  useEffect(() => {
    if (last.current === value) return;
    last.current = value;
    playSound('ruleMark');
  }, [value]);
}

const ARROWS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * One of a few choices, circled in marker. A radio group: the arrow keys move the pen. A choice's
 * `note` is written small under it.
 */
function Choices<T extends string>({
  label,
  choices,
  value,
  editable,
  onChange,
  className,
}: {
  label: string;
  choices: readonly { id: T; label: string; wild?: boolean; note?: string }[];
  value: T | null;
  editable: boolean;
  onChange: (id: T) => void;
  className: string;
}) {
  // The choice the pen just left, its loop being wiped off.
  const [shown, setShown] = useState(value);
  const [erasing, setErasing] = useState<T | null>(null);
  if (value !== shown) {
    setErasing(shown);
    setShown(value);
  }
  useMarkSound(value);

  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const chosen = choices.findIndex((c) => c.id === value);
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const by = ARROWS[e.key];
    if (by === undefined) return;
    e.preventDefault();
    const next = (i + by + choices.length) % choices.length;
    const choice = choices[next];
    if (!choice) return;
    onChange(choice.id);
    buttons.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={className}>
      {choices.map((c, i) => {
        const on = c.id === value;
        const loop = c.wild ? DOUBLE_LOOP : loopAt(i);
        return (
          <button
            key={c.id}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="radio"
            data-choice={c.id}
            aria-checked={on}
            tabIndex={on || (chosen === -1 && i === 0) ? 0 : -1}
            disabled={!editable}
            onClick={() => onChange(c.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className="group flex flex-col items-center rounded-md px-2 py-1.5 font-hand text-lg leading-tight whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-dashed disabled:cursor-default pointer-coarse:min-h-11"
          >
            <span
              className={`relative inline-block ${on ? 'text-ink motion-safe:animate-choice-wiggle' : 'text-ink/60 group-enabled:group-hover:text-ink'}`}
            >
              {c.label}
              {on ? (
                <MarkerLoop key="on" loop={loop} state="on" />
              ) : erasing === c.id ? (
                <MarkerLoop
                  key="erasing"
                  loop={loop}
                  state="erasing"
                  onErased={() => setErasing(null)}
                />
              ) : (
                editable && <MarkerLoop key="preview" loop={loop} state="preview" />
              )}
            </span>
            {c.note && <span className="mt-2 text-sm leading-none text-ink/70">{c.note}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className="mb-0.5 text-xs font-semibold tracking-wide text-ink/50 uppercase">
        {title}
      </legend>
      <div className="@container flex flex-col gap-1.5">{children}</div>
    </fieldset>
  );
}

/** An on/off rule: a hand-drawn box, ticked in marker when it's on. */
function RuleTick({
  icon,
  label,
  hint,
  on,
  disabled,
  onChange,
  onExplain,
}: {
  icon: string;
  label: string;
  hint: string;
  on: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
  onExplain: (explain: boolean) => void;
}) {
  useMarkSound(on);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={hint}
      disabled={disabled}
      onClick={() => onChange(!on)}
      onPointerEnter={() => onExplain(true)}
      onPointerLeave={() => onExplain(false)}
      onFocus={() => onExplain(true)}
      onBlur={() => onExplain(false)}
      className="group flex items-center gap-1.5 rounded-md py-0.5 pr-1 font-hand text-lg whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-dashed disabled:cursor-default pointer-coarse:min-h-11"
    >
      <svg aria-hidden="true" viewBox="0 0 26 26" className="size-6 shrink-0 overflow-visible">
        <path
          d={BOX}
          fill="white"
          className="stroke-ink transition-[fill] group-enabled:group-hover:fill-pop-sun/30"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {on && (
          <path
            d={TICK}
            pathLength={1}
            strokeDasharray={1}
            fill="none"
            className="stroke-pop-purple motion-safe:animate-loop-draw"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <span aria-hidden="true" className={on ? '' : 'opacity-50 grayscale'}>
        {icon}
      </span>
      <span className={on ? 'text-ink' : 'text-ink/55'}>{label}</span>
    </button>
  );
}

function Rules({
  settings,
  editable,
  update,
}: {
  settings: RoomSettings;
  editable: boolean;
  update: (patch: Partial<RoomSettings>) => void;
}) {
  // The rule being pointed at or focused, explained under the boxes.
  const [explained, setExplained] = useState<string | null>(null);
  const rule = RULES.find((r) => r.id === explained);

  return (
    <Group title="Rules">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {RULES.map((r) => (
          <RuleTick
            key={r.id}
            icon={r.icon}
            label={r.label}
            hint={r.hint(settings)}
            on={r.on(settings)}
            disabled={!editable}
            onChange={(on) => update(r.set(on))}
            onExplain={(explain) =>
              setExplained((current) => (explain ? r.id : current === r.id ? null : current))
            }
          />
        ))}
      </div>
      <p aria-live="polite" className="min-h-8 text-xs text-zinc-500">
        {rule
          ? `${rule.label} ${rule.on(settings) ? 'on' : 'off'}: ${rule.hint(settings)}`
          : editable
            ? 'Tick a rule to switch it on or off. Point at one to see what it does.'
            : 'Point at a rule to see what it does.'}
      </p>
    </Group>
  );
}

/**
 * How long the match runs: a preset, or Custom. Pressing Custom slides the ruler over the choices
 * (the host only); its ✓ sends the numbers, and Custom then notes them under it. Numbers that match
 * a preset circle that preset.
 */
function Length({
  settings,
  players,
  editable,
  update,
}: {
  settings: RoomSettings;
  players: number;
  editable: boolean;
  update: (patch: Partial<RoomSettings>) => void;
}) {
  const [ruler, setRuler] = useState<'closed' | 'open' | 'closing'>('closed');
  const box = useRef<HTMLDivElement>(null);
  const pace = paceOf(settings);
  const minutes = maxMatchMinutes(settings, players);
  const choices = [
    ...PACES,
    {
      id: 'custom',
      label: '📏 Custom',
      note: pace === null ? lengthLabel(settings) : undefined,
    },
  ] as const;

  const putAway = useCallback(() => setRuler((r) => (r === 'open' ? 'closing' : r)), []);
  const closed = () => {
    setRuler('closed');
    box.current
      ?.querySelector<HTMLElement>('[data-choice="custom"]')
      ?.focus({ preventScroll: true });
  };

  return (
    <Group title="Length">
      <div ref={box} className="relative flex flex-col gap-1.5">
        <Choices
          label="Length"
          choices={choices}
          value={pace ?? 'custom'}
          editable={editable}
          onChange={(id) => {
            if (id === 'custom') {
              setRuler('open');
              return;
            }
            const p = PACES.find((x) => x.id === id);
            if (p) update({ rounds: p.rounds, drawSeconds: p.drawSeconds });
          }}
          className="grid grid-cols-2 gap-x-1 gap-y-1.5 @[19.5rem]:grid-cols-4"
        />
        <p className="text-xs text-zinc-500">
          Up to ~{minutes} min with {Math.max(2, players)} players
        </p>
        {editable && ruler !== 'closed' && (
          <LengthRuler
            initial={settings}
            players={players}
            wordChoice={settings.wordChoice}
            closing={ruler === 'closing'}
            onConfirm={(length) => {
              if (
                length.rounds !== settings.rounds ||
                length.drawSeconds !== settings.drawSeconds
              ) {
                update(length);
              }
              putAway();
            }}
            onCancel={putAway}
            onClosed={closed}
          />
        )}
      </div>
    </Group>
  );
}

const CARD_CHOICES = CARD_POOLS.map((c) => ({ ...c, wild: c.id === 'chaos' }));

export function RoomSettingsForm({ view, editable }: { view: RoomView; editable: boolean }) {
  const s = view.settings;
  const update = (patch: Partial<RoomSettings>) =>
    sendToRoom({ t: 'room:settings', settings: patch });
  const pool = cardPoolOf(s);
  const players = view.players.filter((p) => p.connected).length;

  return (
    // Two columns when there's room (read-only for players, on results), else one.
    <div className="@container">
      <div className="grid gap-x-6 gap-y-2.5 @xl:grid-cols-2">
        <Length settings={s} players={players} editable={editable} update={update} />

        <Group title="Cards">
          {/* Four in a row when they fit, else two by two. */}
          <Choices
            label="Cards"
            choices={CARD_CHOICES}
            value={pool}
            editable={editable}
            onChange={(id) => update(cardPoolSettings(id))}
            className="grid grid-cols-2 gap-x-1 gap-y-1.5 @[19.5rem]:grid-cols-4"
          />
          <p className="text-xs text-zinc-500">{CARD_POOLS.find((c) => c.id === pool)?.hint}</p>
        </Group>

        <Rules settings={s} editable={editable} update={update} />
      </div>
    </div>
  );
}
