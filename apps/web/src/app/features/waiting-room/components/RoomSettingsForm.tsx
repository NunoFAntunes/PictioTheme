import { rushWindowMs } from '@pictiotheme/game-core';
import type { RoomSettings } from '@pictiotheme/protocol';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { sendToRoom, type RoomView } from '../../../realtime';
import { DOUBLE_LOOP, loopAt, MarkerLoop } from '../../../ui/MarkerLoop';
import { playSound } from '../../sound';
import { CARD_POOLS, cardPoolOf, cardPoolSettings } from '../card-pool';
import { maxMatchMinutes, paceOf, PACES } from '../match-length';

/**
 * The house rules, as three quick choices: how long the match runs (a preset), which cards come
 * up, and which rules are on (ticked boxes). "Fine-tune" folds away the exact rounds, draw time
 * and room size. Editable by the host; everyone else sees them read-only. The deck is chosen
 * beside them (WaitingRoom); the room's name and public/private sit on top (RoomTitle).
 *
 * They're written on a notepad (WaitingRoom's Notebook): a choice is circled in marker, and a rule
 * is ticked. The loop and the tick draw themselves when the setting changes, so the players
 * watch the host's pen too.
 */

const ROUNDS = Array.from({ length: 10 }, (_, i) => i + 1);
const DRAW_SECONDS = [30, 45, 60, 80, 100, 120, 150, 180];
const MAX_PLAYERS = Array.from({ length: 15 }, (_, i) => i + 2);

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
 * One of a few choices, circled in marker. A radio group: the arrow keys move the pen. `value` is
 * null when none of them fits (a custom length).
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
  choices: readonly { id: T; label: string; wild?: boolean }[];
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
            aria-checked={on}
            tabIndex={on || (chosen === -1 && i === 0) ? 0 : -1}
            disabled={!editable}
            onClick={() => onChange(c.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className="group flex justify-center rounded-md px-2 py-1.5 font-hand text-lg leading-tight whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-dashed disabled:cursor-default pointer-coarse:min-h-11"
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

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="flex min-w-0 flex-col text-sm font-medium">
        {label}
        {hint && <span className="text-xs font-normal text-zinc-500">{hint}</span>}
      </span>
      <div className="flex shrink-0 items-center gap-2 text-sm">{children}</div>
    </div>
  );
}

/** − value +, stepping through `options`. */
function Stepper({
  label,
  value,
  options,
  format = String,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  options: readonly number[];
  format?: (n: number) => string;
  disabled: boolean;
  onChange: (n: number) => void;
}) {
  const index = options.indexOf(value);
  const step = (by: number) => {
    const next = options[index + by];
    if (next !== undefined) onChange(next);
  };
  const button =
    'size-7 rounded-full border-2 border-ink bg-white text-base leading-none hover:bg-pop-sun/40 disabled:opacity-40 disabled:hover:bg-white';
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={`Less: ${label}`}
        disabled={disabled || index <= 0}
        onClick={() => step(-1)}
        className={button}
      >
        −
      </button>
      <output aria-live="polite" className="w-12 text-center font-semibold tabular-nums">
        {format(value)}
      </output>
      <button
        type="button"
        aria-label={`More: ${label}`}
        disabled={disabled || index === -1 || index >= options.length - 1}
        onClick={() => step(1)}
        className={button}
      >
        +
      </button>
    </div>
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

/** The exact numbers behind the Length preset, and the room's size. Open when they're custom. */
function FineTune({
  settings,
  editable,
  update,
}: {
  settings: RoomSettings;
  editable: boolean;
  update: (patch: Partial<RoomSettings>) => void;
}) {
  const [open, setOpen] = useState(() => paceOf(settings) === null);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group border-t-2 border-dashed border-ink/20"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-zinc-500 transition group-open:rotate-90">
          ▸
        </span>
        Fine-tune
        <span className="ml-auto truncate text-xs font-normal text-zinc-500">
          {settings.rounds} round{settings.rounds === 1 ? '' : 's'} · {settings.drawSeconds}s ·{' '}
          {settings.maxPlayers} players
        </span>
      </summary>
      <div className="flex flex-col divide-y divide-dashed divide-ink/15">
        <Row label="Rounds" hint="Everyone draws once a round">
          <Stepper
            label="Rounds"
            value={settings.rounds}
            options={ROUNDS}
            disabled={!editable}
            onChange={(rounds) => update({ rounds })}
          />
        </Row>
        <Row label="Draw time">
          <Stepper
            label="Draw time"
            value={settings.drawSeconds}
            options={DRAW_SECONDS}
            format={(n) => `${n}s`}
            disabled={!editable}
            onChange={(drawSeconds) => update({ drawSeconds })}
          />
        </Row>
        <Row label="Max players">
          <Stepper
            label="Max players"
            value={settings.maxPlayers}
            options={MAX_PLAYERS}
            disabled={!editable}
            onChange={(maxPlayers) => update({ maxPlayers })}
          />
        </Row>
      </div>
    </details>
  );
}

const CARD_CHOICES = CARD_POOLS.map((c) => ({ ...c, wild: c.id === 'chaos' }));

export function RoomSettingsForm({ view, editable }: { view: RoomView; editable: boolean }) {
  const s = view.settings;
  const update = (patch: Partial<RoomSettings>) =>
    sendToRoom({ t: 'room:settings', settings: patch });
  const pace = paceOf(s);
  const pool = cardPoolOf(s);
  const players = view.players.filter((p) => p.connected).length;
  const minutes = maxMatchMinutes(s, players);

  return (
    // Two columns when there's room (read-only for players, on results), else one.
    <div className="@container">
      <div className="grid gap-x-6 gap-y-2.5 @xl:grid-cols-2">
        <Group title="Length">
          <Choices
            label="Length"
            choices={PACES}
            value={pace}
            editable={editable}
            onChange={(id) => {
              const p = PACES.find((x) => x.id === id);
              if (p) update({ rounds: p.rounds, drawSeconds: p.drawSeconds });
            }}
            className="grid grid-cols-3 gap-2"
          />
          <p className="text-xs text-zinc-500">
            Up to ~{minutes} min with {Math.max(2, players)} players
            {pace === null && ' · custom length'}
          </p>
        </Group>

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
        <div className="@xl:pt-5">
          <FineTune settings={s} editable={editable} update={update} />
        </div>
      </div>
    </div>
  );
}
