import {
  LINE_HEIGHTS,
  TEAMS,
  TOWER_MAX_PER_CREW,
  TOWER_MIN_PER_CREW,
  type LineHeight,
  type Team,
  type TowerPlayer,
  type TowerSettings,
} from '@pictiotheme/protocol/tower';
import { useState } from 'react';
import { sendToRoom, type RoomView } from '../../../realtime';
import { Avatar } from '../../../ui/Avatar';
import { Button } from '../../../ui/Button';
import { CREW_BG, CREW_NAME } from '../../../ui/CrewBadge';
import { Panel } from '../../../ui/Panel';

function startProblem(view: RoomView): string | null {
  const count = (team: Team) => view.players.filter((p) => p.connected && p.team === team).length;
  if (TEAMS.some((t) => count(t) < TOWER_MIN_PER_CREW)) {
    return `Each crew needs ${TOWER_MIN_PER_CREW} players`;
  }
  if (Math.abs(count('orange') - count('teal')) > 1)
    return 'Even out the crews (one apart at most)';
  return null;
}

function CrewColumn({ team, view }: { team: Team; view: RoomView }) {
  const members = view.players.filter((p) => p.team === team);
  const me = view.players.find((p) => p.id === view.you);
  const isHost = view.hostId === view.you;
  const other: Team = team === 'orange' ? 'teal' : 'orange';
  return (
    <section
      aria-label={`${CREW_NAME[team]} crew`}
      className="flex min-h-72 flex-col overflow-hidden rounded-3xl border-4 border-white bg-dusk-900 shadow-panel"
    >
      <header
        className={`flex items-center justify-between rounded-t-md px-4 py-2 ${CREW_BG[team]}`}
      >
        <h2 className="font-display text-lg tracking-wide text-ink">{CREW_NAME[team]} crew</h2>
        <span className="font-display text-sm text-ink/70">
          {members.length}/{TOWER_MAX_PER_CREW}
        </span>
      </header>
      <ul className="flex-1 space-y-1.5 p-3">
        {members.map((p: TowerPlayer) => (
          <li
            key={p.id}
            className={`flex items-center gap-3 rounded-xl bg-dusk-800 px-3 py-2 ${p.connected ? '' : 'opacity-50'}`}
          >
            <Avatar id={p.avatar} name={p.name} />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {p.name}
              {p.id === view.you && <span className="ml-2 text-xs text-cloud-dim">(you)</span>}
            </span>
            {p.id === view.hostId && (
              <span className="rounded-lg bg-sun px-1.5 py-0.5 font-display text-[10px] text-ink">
                HOST
              </span>
            )}
            {isHost && p.id !== view.you && (
              <button
                type="button"
                onClick={() => sendToRoom({ t: 'crew:move', playerId: p.id, team: other })}
                className="rounded-lg px-2 py-1 text-xs text-cloud-dim hover:bg-white/10"
                aria-label={`Move ${p.name} to the ${CREW_NAME[other]} crew`}
              >
                Move ⇄
              </button>
            )}
          </li>
        ))}
      </ul>
      {me?.team !== team && (
        <div className="p-3 pt-0">
          <Button
            className="w-full"
            onClick={() => sendToRoom({ t: 'crew:join', team })}
            disabled={members.length >= TOWER_MAX_PER_CREW}
          >
            Join {CREW_NAME[team]}
          </Button>
        </div>
      )}
    </section>
  );
}

function Choice<T extends string | number | boolean>({
  label,
  value,
  options,
  onPick,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onPick: (value: T) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-28 text-sm font-semibold text-ink/75">{label}</span>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <Button
            key={String(o.value)}
            pressed={o.value === value}
            disabled={disabled}
            onClick={() => onPick(o.value)}
            className="text-xs"
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** Before a match: crews, the host's settings, the invite link. */
export function WaitingRoom({ view }: { view: RoomView }) {
  const isHost = view.hostId === view.you;
  const problem = startProblem(view);
  const [copied, setCopied] = useState(false);
  const set = (settings: Partial<TowerSettings>) => sendToRoom({ t: 'settings:update', settings });
  const s = view.settings;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/r/${view.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-wrap items-center gap-4">
        <a href="/" className="title-outline font-display text-3xl tracking-wide">
          Doodle <span className="text-sun">Tower</span>
        </a>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm font-semibold text-dusk-900">Room</span>
          <span
            className="title-outline font-display text-2xl tracking-[0.2em]"
            data-testid="room-code"
          >
            {view.code}
          </span>
          <Button variant="soft" onClick={() => void copyLink()}>
            {copied ? 'Copied!' : 'Copy invite link'}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {TEAMS.map((team) => (
          <CrewColumn key={team} team={team} view={view} />
        ))}
      </div>

      <Panel title={isHost ? 'Game rules' : 'Game rules (set by the host)'}>
        <div className="space-y-2 px-2">
          <Choice
            label="Height line"
            value={s.line}
            disabled={!isHost}
            onPick={(line: LineHeight) => set({ line })}
            options={(['short', 'medium', 'tall'] as const).map((l) => ({
              value: l,
              label: `${l[0]?.toUpperCase()}${l.slice(1)} · ${LINE_HEIGHTS[l]} m`,
            }))}
          />
          <Choice
            label="Drawing time"
            value={s.roundSeconds}
            disabled={!isHost}
            onPick={(roundSeconds: number) => set({ roundSeconds })}
            options={[45, 60, 90].map((n) => ({ value: n, label: `${n}s` }))}
          />
          <Choice
            label="Fumble daze"
            value={s.dazeSeconds}
            disabled={!isHost}
            onPick={(dazeSeconds: number) => set({ dazeSeconds })}
            options={[0, 5, 8].map((n) => ({ value: n, label: n === 0 ? 'Off' : `${n}s` }))}
          />
          <Choice
            label="Steals"
            value={s.steals}
            disabled={!isHost}
            onPick={(steals: boolean) => set({ steals })}
            options={[
              { value: true, label: 'On' },
              { value: false, label: 'Off' },
            ]}
          />
        </div>
      </Panel>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {isHost ? (
          <>
            {problem && <span className="text-sm text-cloud-dim">{problem}</span>}
            <Button onClick={() => sendToRoom({ t: 'crew:shuffle' })}>Shuffle crews</Button>
            <Button
              variant="primary"
              className="h-14 px-8 text-lg"
              disabled={problem !== null}
              onClick={() => sendToRoom({ t: 'match:start' })}
            >
              Start building
            </Button>
          </>
        ) : (
          <span className="font-display text-cloud-dim">Waiting for the host to start…</span>
        )}
      </div>
    </main>
  );
}
