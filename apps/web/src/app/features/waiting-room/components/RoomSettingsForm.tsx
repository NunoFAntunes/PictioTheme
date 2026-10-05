import type { Difficulty, RoomSettings } from '@pictiotheme/protocol';
import type { ReactNode } from 'react';
import { sendToRoom, type RoomView } from '../../../realtime';
import { maxMatchMinutes, paceOf, PACES } from '../match-length';

/**
 * The house rules, in groups: how long the match runs, which cards come up, how guessing works,
 * and who can join. Editable by the host; everyone else sees them read-only. The deck is chosen
 * beside them (WaitingRoom), and the room's name sits on top (RoomTitle).
 */

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];
const ROUNDS = Array.from({ length: 10 }, (_, i) => i + 1);
const DRAW_SECONDS = [30, 45, 60, 80, 100, 120, 150, 180];
const MAX_PLAYERS = Array.from({ length: 15 }, (_, i) => i + 2);

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        {title}
      </legend>
      <div className="flex flex-col divide-y divide-zinc-100 rounded-xl bg-zinc-50 px-3 dark:divide-zinc-800 dark:bg-zinc-900">
        {children}
      </div>
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

function Toggle({
  on,
  disabled,
  onChange,
  label,
}: {
  on: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition disabled:opacity-60 ${on ? 'bg-brand-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
    >
      <span
        className={`block size-5 rounded-full bg-white transition ${on ? 'translate-x-5' : ''}`}
      />
    </button>
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
    'size-7 rounded-full border border-zinc-300 bg-white text-base leading-none hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700';
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

function Chip({
  on,
  disabled,
  onClick,
  children,
}: {
  on: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-3 py-0.5 text-sm whitespace-nowrap disabled:cursor-not-allowed ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-800'}`}
    >
      {children}
    </button>
  );
}

export function RoomSettingsForm({ view, editable }: { view: RoomView; editable: boolean }) {
  const s = view.settings;
  const update = (patch: Partial<RoomSettings>) =>
    sendToRoom({ t: 'room:settings', settings: patch });
  const pace = paceOf(s);
  const players = view.players.filter((p) => p.connected).length;
  const minutes = maxMatchMinutes(s, players);

  return (
    // Two columns of groups when there's room (read-only for players, on results), else one.
    <div className="@container">
      <div className="grid gap-4 @xl:grid-cols-2">
        <Group title="⏱ Pace">
          <div className="flex flex-col gap-1.5 py-2">
            <div role="group" aria-label="Pace" className="grid grid-cols-3 gap-1.5">
              {PACES.map((p) => (
                <Chip
                  key={p.id}
                  on={pace === p.id}
                  disabled={!editable}
                  onClick={() => update({ rounds: p.rounds, drawSeconds: p.drawSeconds })}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-zinc-500">
              Up to ~{minutes} min with {Math.max(2, players)} players
              {pace === null && ' · custom pace'}
            </p>
          </div>
          <Row label="Rounds" hint="Everyone draws once a round">
            <Stepper
              label="Rounds"
              value={s.rounds}
              options={ROUNDS}
              disabled={!editable}
              onChange={(rounds) => update({ rounds })}
            />
          </Row>
          <Row label="Draw time">
            <Stepper
              label="Draw time"
              value={s.drawSeconds}
              options={DRAW_SECONDS}
              format={(n) => `${n}s`}
              disabled={!editable}
              onChange={(drawSeconds) => update({ drawSeconds })}
            />
          </Row>
        </Group>

        <Group title="🃏 Cards">
          <Row label="Difficulty">
            <div role="group" aria-label="Difficulty" className="flex flex-wrap gap-1.5">
              {DIFFICULTIES.map((d) => {
                const on = s.difficulties.includes(d.value);
                return (
                  <Chip
                    key={d.value}
                    on={on}
                    // The last one stays on: a match needs at least one difficulty.
                    disabled={!editable || (on && s.difficulties.length === 1)}
                    onClick={() =>
                      update({
                        difficulties: on
                          ? s.difficulties.filter((x) => x !== d.value)
                          : [...s.difficulties, d.value],
                      })
                    }
                  >
                    {d.label}
                  </Chip>
                );
              })}
            </div>
          </Row>
          <Row label="Silly Mode 🤪" hint={s.silly.enabled ? 'Share of silly cards' : undefined}>
            {s.silly.enabled && (
              <label className="flex items-center gap-1">
                <span className="sr-only">Silly cards</span>
                <input
                  type="range"
                  min={10}
                  max={75}
                  step={5}
                  disabled={!editable}
                  value={Math.round(s.silly.ratio * 100)}
                  onChange={(e) =>
                    update({ silly: { ...s.silly, ratio: Number(e.target.value) / 100 } })
                  }
                  className="w-24 accent-brand-600"
                />
                <span className="w-9 tabular-nums">{Math.round(s.silly.ratio * 100)}%</span>
              </label>
            )}
            <Toggle
              label="Silly Mode"
              on={s.silly.enabled}
              disabled={!editable}
              onChange={(enabled) => update({ silly: { ...s.silly, enabled } })}
            />
          </Row>
          <Row
            label="Drawer picks from 3 cards"
            hint={s.wordChoice === 1 ? 'Or draws the first one' : undefined}
          >
            <Toggle
              label="Drawer picks from 3 cards"
              on={s.wordChoice === 3}
              disabled={!editable}
              onChange={(on) => update({ wordChoice: on ? 3 : 1 })}
            />
          </Row>
        </Group>

        <Group title="💬 Guessing">
          <Row
            label="Show guesses"
            hint={
              s.guessVisibility === 'show'
                ? 'Everyone sees the wrong guesses'
                : 'Players only see their own'
            }
          >
            <Toggle
              label="Show guesses"
              on={s.guessVisibility === 'show'}
              disabled={!editable}
              onChange={(on) => update({ guessVisibility: on ? 'show' : 'hide' })}
            />
          </Row>
          <Row label="Hints" hint="A letter shows at ½ and ¾ of the time">
            <Toggle
              label="Hints"
              on={s.hints}
              disabled={!editable}
              onChange={(hints) => update({ hints })}
            />
          </Row>
        </Group>

        <Group title="🚪 Room">
          <Row
            label="Public 🌍"
            hint={view.isPublic ? 'Listed on the home page' : 'Only people with the code'}
          >
            <Toggle
              label="Public room"
              on={view.isPublic}
              disabled={!editable}
              onChange={(isPublic) => sendToRoom({ t: 'room:details', isPublic })}
            />
          </Row>
          <Row label="Max players">
            <Stepper
              label="Max players"
              value={s.maxPlayers}
              options={MAX_PLAYERS}
              disabled={!editable}
              onChange={(maxPlayers) => update({ maxPlayers })}
            />
          </Row>
        </Group>
      </div>
    </div>
  );
}
