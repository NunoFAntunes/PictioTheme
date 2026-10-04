import type { Difficulty, RoomSettings } from '@pictiotheme/protocol';
import type { ReactNode } from 'react';
import { sendToRoom, type RoomView } from '../../../realtime';
import { useDecks } from '../../create-room';
import { useMyDecks } from '../../generate-deck';

/** Room settings. Editable by the host; everyone else sees them read-only. */

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2 text-sm">{children}</div>
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
      className={`h-6 w-11 rounded-full p-0.5 transition disabled:opacity-60 ${on ? 'bg-brand-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
    >
      <span
        className={`block size-5 rounded-full bg-white transition ${on ? 'translate-x-5' : ''}`}
      />
    </button>
  );
}

export function RoomSettingsForm({ view, editable }: { view: RoomView; editable: boolean }) {
  const decks = useDecks();
  const myDecks = useMyDecks();
  const s = view.settings;
  // The room's deck may be someone else's generated deck, so it's always an option.
  const deckOptions = [
    ...(view.deck ? [{ id: view.deck.id, title: view.deck.title }] : []),
    ...(myDecks.data ?? []),
    ...(decks.data ?? []),
  ].filter((d, i, all) => all.findIndex((x) => x.id === d.id) === i);
  const update = (patch: Partial<RoomSettings>) =>
    sendToRoom({ t: 'room:settings', settings: patch });
  const select =
    'rounded-md border border-zinc-300 bg-transparent px-2 py-1 disabled:opacity-60 dark:border-zinc-700';

  return (
    <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
      <Row label="Deck">
        <select
          aria-label="Deck"
          className={select}
          disabled={!editable}
          value={s.deckId}
          onChange={(e) => update({ deckId: e.target.value })}
        >
          {deckOptions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
        {!view.deck && <span className="text-xs text-zinc-500">loading…</span>}
      </Row>
      <Row label="Difficulty">
        {DIFFICULTIES.map((d) => {
          const on = s.difficulties.includes(d.value);
          return (
            <button
              key={d.value}
              type="button"
              aria-pressed={on}
              disabled={!editable || (on && s.difficulties.length === 1)}
              onClick={() =>
                update({
                  difficulties: on
                    ? s.difficulties.filter((x) => x !== d.value)
                    : [...s.difficulties, d.value],
                })
              }
              className={`rounded-full border px-3 py-0.5 ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-300 dark:border-zinc-700'} disabled:cursor-not-allowed`}
            >
              {d.label}
            </button>
          );
        })}
      </Row>
      <Row label="Silly Mode 🤪">
        <Toggle
          label="Silly Mode"
          on={s.silly.enabled}
          disabled={!editable}
          onChange={(enabled) => update({ silly: { ...s.silly, enabled } })}
        />
        {s.silly.enabled && (
          <label className="flex items-center gap-1">
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
            />
            <span className="w-9 tabular-nums">{Math.round(s.silly.ratio * 100)}%</span>
          </label>
        )}
      </Row>
      <Row label="Rounds">
        <select
          aria-label="Rounds"
          className={select}
          disabled={!editable}
          value={s.rounds}
          onChange={(e) => update({ rounds: Number(e.target.value) })}
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </Row>
      <Row label="Draw time">
        <select
          aria-label="Draw time"
          className={select}
          disabled={!editable}
          value={s.drawSeconds}
          onChange={(e) => update({ drawSeconds: Number(e.target.value) })}
        >
          {[30, 45, 60, 80, 100, 120, 150, 180].map((n) => (
            <option key={n} value={n}>
              {n}s
            </option>
          ))}
        </select>
      </Row>
      <Row label="Max players">
        <select
          aria-label="Max players"
          className={select}
          disabled={!editable}
          value={s.maxPlayers}
          onChange={(e) => update({ maxPlayers: Number(e.target.value) })}
        >
          {Array.from({ length: 15 }, (_, i) => i + 2).map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </Row>
      <Row label="Show guesses">
        <Toggle
          label="Show guesses"
          on={s.guessVisibility === 'show'}
          disabled={!editable}
          onChange={(on) => update({ guessVisibility: on ? 'show' : 'hide' })}
        />
      </Row>
      <Row label="Hints">
        <Toggle
          label="Hints"
          on={s.hints}
          disabled={!editable}
          onChange={(hints) => update({ hints })}
        />
      </Row>
      <Row label="Drawer picks from 3 cards">
        <Toggle
          label="Drawer picks from 3 cards"
          on={s.wordChoice === 3}
          disabled={!editable}
          onChange={(on) => update({ wordChoice: on ? 3 : 1 })}
        />
      </Row>
    </div>
  );
}
