import type { ReactNode } from 'react';
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
import { sendToRoom, type RoomView } from '../../../realtime';
import { Avatar } from '../../../ui/Avatar';
import { Button } from '../../../ui/Button';
import { CREW_BG, CREW_NAME } from '../../../ui/CrewBadge';
import { Panel } from '../../../ui/Panel';
import { Segmented } from '../../../ui/Segmented';
import { Switch } from '../../../ui/Switch';
import { AccountCorner } from '../../account';
import { InviteCard } from './InviteCard';

function startProblem(view: RoomView): string | null {
  // Bots fill the crews in test mode.
  if (view.settings.testMode) return null;
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
      className="flex min-h-0 flex-col overflow-hidden rounded-3xl border-4 border-white bg-dusk-900 shadow-panel"
    >
      <header
        className={`flex items-center justify-between rounded-t-md px-4 py-2 ${CREW_BG[team]}`}
      >
        <h2 className="font-display text-lg tracking-wide text-ink">{CREW_NAME[team]} crew</h2>
        <span className="font-display text-sm text-ink/70">
          {members.length}/{TOWER_MAX_PER_CREW}
        </span>
      </header>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2.5">
        {members.map((p: TowerPlayer) => (
          <li
            key={p.id}
            className={`flex items-center gap-2.5 rounded-xl bg-dusk-800 px-2.5 py-1 ${p.connected ? '' : 'opacity-50'}`}
          >
            <Avatar id={p.avatar} name={p.name} size={30} />
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
        <div className="p-2.5 pt-0">
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

/** One rule on its own little plank: an icon tile, its name, and the control at the end. */
function Rule({
  icon,
  tile,
  label,
  children,
}: {
  icon: string;
  /** The icon tile's colour. */
  tile: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-card-light py-1.5 pr-2 pl-1.5 shadow-[0_3px_0_var(--color-card-edge)]">
      <span
        aria-hidden="true"
        className={`flex size-9 shrink-0 -rotate-3 items-center justify-center rounded-xl border-[3px] border-ink text-lg leading-none ${tile}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate font-display text-[15px] tracking-wide text-ink">
        {label}
      </span>
      {children}
    </div>
  );
}

const LINES = ['short', 'medium', 'tall'] as const;

/** The host's settings, which everyone else sees as they are set. */
function GameRules({ view }: { view: RoomView }) {
  const isHost = view.hostId === view.you;
  const set = (settings: Partial<TowerSettings>) => sendToRoom({ t: 'settings:update', settings });
  const s = view.settings;
  const locked = !isHost;

  return (
    <Panel
      title="Game rules"
      actions={
        locked && (
          <span className="rounded-lg bg-dusk-800 px-2 py-0.5 font-display text-xs text-cloud">
            🔒 Set by the host
          </span>
        )
      }
    >
      <div className="space-y-2 px-1">
        <Rule icon="🚩" tile="bg-coral" label="Height line">
          <Segmented
            label="Height line"
            value={s.line}
            disabled={locked}
            onPick={(line: LineHeight) => set({ line })}
            options={LINES.map((l) => ({
              value: l,
              label: `${l[0]?.toUpperCase()}${l.slice(1)} · ${LINE_HEIGHTS[l]} m`,
            }))}
          />
        </Rule>
        <Rule icon="⏱️" tile="bg-sky-light" label="Drawing time">
          <Segmented
            label="Drawing time"
            value={s.roundSeconds}
            disabled={locked}
            onPick={(roundSeconds: number) => set({ roundSeconds })}
            options={[45, 60, 90].map((n) => ({ value: n, label: `${n}s` }))}
          />
        </Rule>
        <Rule icon="💫" tile="bg-sun" label="Fumble daze">
          <Segmented
            label="Fumble daze"
            value={s.dazeSeconds}
            disabled={locked}
            onPick={(dazeSeconds: number) => set({ dazeSeconds })}
            options={[0, 5, 8].map((n) => ({ value: n, label: n === 0 ? 'Off' : `${n}s` }))}
          />
        </Rule>
        <div className="grid grid-cols-2 gap-2">
          <Rule icon="🦝" tile="bg-crew-teal" label="Steals">
            <Switch
              label="Steals"
              checked={s.steals}
              disabled={locked}
              onChange={(steals) => set({ steals })}
            />
          </Rule>
          <Rule icon="🌀" tile="bg-[oklch(0.75_0.13_300)]" label="Curses & spells">
            <Switch
              label="Curses & spells"
              checked={s.powers}
              disabled={locked}
              onChange={(powers) => set({ powers })}
            />
          </Rule>
        </div>
      </div>
    </Panel>
  );
}

/**
 * Before a match (docs/tower/design/screens.md#2-waiting-room), on one screen with no scrolling:
 * the crews and the rules on the left, the invite card and the start button on the right.
 */
export function WaitingRoom({ view }: { view: RoomView }) {
  const isHost = view.hostId === view.you;
  const problem = startProblem(view);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col justify-center px-5 py-4 lg:h-dvh">
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:max-h-[54rem]">
        <header className="flex shrink-0 items-center gap-4">
          <AccountCorner fixed={false} roomCode={view.code} />
          <a href="/" className="title-outline font-display text-3xl tracking-wide">
            Doodle <span className="text-sun">Tower</span>
          </a>
          {view.settings.testMode && (
            <p className="rounded-xl bg-sun px-3 py-1 text-sm font-semibold text-sun-ink">
              🧪 Test mode: bots fill the crews and draw rectangles. Start whenever you like.
            </p>
          )}
        </header>

        <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="flex min-h-0 flex-col gap-4">
            <div className="grid min-h-56 flex-1 grid-cols-2 gap-4">
              {TEAMS.map((team) => (
                <CrewColumn key={team} team={team} view={view} />
              ))}
            </div>
            <GameRules view={view} />
          </div>

          <div className="flex min-h-0 flex-col gap-4">
            <InviteCard view={view} className="min-h-0 flex-1" />
            <div className="card-panel flex shrink-0 flex-col gap-2 rounded-3xl p-3">
              {isHost ? (
                <>
                  <div className="flex gap-3">
                    <Button className="h-14 px-4" onClick={() => sendToRoom({ t: 'crew:shuffle' })}>
                      🔀 Shuffle crews
                    </Button>
                    <Button
                      variant="primary"
                      className="h-14 flex-1 text-xl"
                      disabled={problem !== null}
                      onClick={() => sendToRoom({ t: 'match:start' })}
                    >
                      Start building
                    </Button>
                  </div>
                  {problem && (
                    <p className="text-center text-sm font-semibold text-ink/65">{problem}</p>
                  )}
                </>
              ) : (
                <p className="py-3 text-center font-display text-lg text-dusk-800">
                  Waiting for the host to start…
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
