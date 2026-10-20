import { TEAMS, type TowerAward } from '@pictiotheme/protocol/tower';
import { sendToRoom, type RoomView } from '../../../realtime';
import { Button } from '../../../ui/Button';
import { CREW_BG, CREW_NAME, CREW_TEXT } from '../../../ui/CrewBadge';
import { Panel } from '../../../ui/Panel';
import { TowerPanel } from '../../game';

const AWARDS: Record<TowerAward['kind'], { title: string; icon: string }> = {
  best_thief: { title: 'Best thief', icon: '🦝' },
  meanest_sender: { title: 'Meanest sender', icon: '💣' },
  master_builder: { title: 'Master builder', icon: '🧱' },
  quickest_guesser: { title: 'Quickest guesser', icon: '⚡' },
};

const REASON = { topped_out: 'topped out', time: 'was taller when time ran out', abandoned: '' };

/** The match is over: who won, both towers as they stand, the awards and everyone's numbers. */
export function Results({ view }: { view: RoomView }) {
  const results = view.results;
  if (!results) return null;
  const isHost = view.hostId === view.you;
  const name = (id: string) => view.players.find((p) => p.id === id)?.name ?? '?';
  return (
    <main className="mx-auto flex h-dvh w-full max-w-6xl flex-col gap-4 px-5 py-5">
      <header className="text-center">
        {results.winner ? (
          <h1 className="font-display text-5xl leading-tight">
            <span className={CREW_TEXT[results.winner]}>{CREW_NAME[results.winner]}</span> crew
            wins!
          </h1>
        ) : (
          <h1 className="font-display text-5xl leading-tight">
            {results.reason === 'abandoned' ? 'Everyone went home' : 'A draw!'}
          </h1>
        )}
        {results.winner && (
          <p className="mt-1 text-cloud-dim">Their tower {REASON[results.reason]}.</p>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.2fr_1fr] gap-4">
        {TEAMS.map((team, i) => (
          <div key={team} className={`min-h-0 ${i === 1 ? 'order-3' : ''}`}>
            <TowerPanel team={team} view={view} placingHere={false} />
          </div>
        ))}
        <div className="order-2 flex min-h-0 flex-col gap-3">
          <Panel title="Awards">
            <ul className="space-y-1.5 px-2">
              {results.awards.length === 0 && (
                <li className="text-sm text-ink/60">No awards this time.</li>
              )}
              {results.awards.map((a) => (
                <li key={a.kind} className="flex items-center gap-2 text-sm">
                  <span aria-hidden="true">{AWARDS[a.kind].icon}</span>
                  <span className="font-semibold">{AWARDS[a.kind].title}:</span>
                  <span>{name(a.playerId)}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="The crews" className="min-h-0 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-ink/60">
                <tr>
                  <th className="px-2 font-semibold">Player</th>
                  <th className="px-1 text-right font-semibold" title="Drawings">
                    ✏️
                  </th>
                  <th className="px-1 text-right font-semibold" title="Guessed">
                    ✅
                  </th>
                  <th className="px-1 text-right font-semibold" title="Steals">
                    🦝
                  </th>
                  <th className="px-1 text-right font-semibold" title="Sends">
                    💣
                  </th>
                  <th className="px-1 text-right font-semibold" title="Placed">
                    🧱
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.players.map((p) => (
                  <tr key={p.id} className="border-t border-ink/10">
                    <td className="flex items-center gap-2 px-2 py-1">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${CREW_BG[p.team]}`}
                        aria-hidden="true"
                      />
                      {p.name}
                    </td>
                    <td className="px-1 text-right tabular-nums">{p.drawings}</td>
                    <td className="px-1 text-right tabular-nums">{p.solves}</td>
                    <td className="px-1 text-right tabular-nums">{p.steals}</td>
                    <td className="px-1 text-right tabular-nums">{p.sends}</td>
                    <td className="px-1 text-right tabular-nums">{p.placements}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <div className="mt-auto flex justify-center gap-3">
            {isHost ? (
              <Button
                variant="primary"
                className="h-14 px-8 text-lg"
                onClick={() => sendToRoom({ t: 'match:rematch' })}
              >
                Rematch
              </Button>
            ) : (
              <span className="font-display text-cloud-dim">Waiting for the host…</span>
            )}
            <Button className="h-14" onClick={() => location.assign('/')}>
              Leave
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
