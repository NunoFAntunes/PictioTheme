import type { Team } from '@pictiotheme/protocol/tower';
import type { ReactNode } from 'react';
import { useServerNow, type RoomView } from '../../../realtime';
import { CREW_BG, CREW_NAME } from '../../../ui/CrewBadge';
import { LiveTower } from '../../tower';
import type { PlacementController } from '../placement';

const CREW_BORDER: Record<Team, string> = {
  orange: 'border-crew-orange',
  teal: 'border-crew-teal',
};

/**
 * One crew's tower with its status: the queue, who's placing and their time, a daze, topping out.
 * It's the star of the screen: wide, so pieces falling off the sides stay in view. Every tower is
 * framed the same way (the placer's whole reach), so nothing zooms when you start placing; the
 * controls are on the play card, never over the tower. `children` float in the sky (the other
 * crew's drawing).
 */
export function TowerPanel({
  team,
  view,
  controls,
  placingHere,
  mine = false,
  children,
}: {
  team: Team;
  view: RoomView;
  /** The placer's controls, when you might be placing here. */
  controls?: PlacementController;
  /** You're placing on this tower. */
  placingHere: boolean;
  /** Your crew's tower. */
  mine?: boolean;
  children?: ReactNode;
}) {
  const now = useServerNow();
  const crew = view.crews[team];
  const placer = crew.placing ? view.players.find((p) => p.id === crew.placing?.placerId) : null;
  const dazed = crew.dazedUntil !== null && crew.dazedUntil > now;
  return (
    <section
      aria-label={`${CREW_NAME[team]} tower`}
      className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border-4 bg-sky shadow-panel ${mine ? CREW_BORDER[team] : 'border-white'}`}
    >
      <header className="z-10 flex items-center gap-2 bg-dusk-950/85 px-3 py-2">
        <span className={`h-3.5 w-3.5 rounded-full ${CREW_BG[team]}`} aria-hidden="true" />
        <span className="font-display text-sm tracking-wide">
          {mine ? 'Your tower' : `${CREW_NAME[team]} tower`}
        </span>
        {crew.queue.length > 0 && (
          <span className="rounded-lg bg-card-light px-1.5 text-xs font-semibold text-ink">
            {crew.queue.length} waiting
          </span>
        )}
        {crew.placing && (
          <span className="ml-auto flex items-baseline gap-1.5 text-sm" role="timer">
            <span className="text-cloud-dim">
              {placingHere ? 'You’re placing' : `${placer?.name ?? '…'} placing`}
            </span>
            <span
              className={`w-8 text-right font-display text-base tabular-nums ${crew.placing.endsAt - now < 5000 ? 'text-sun' : ''}`}
            >
              {Math.max(0, Math.ceil((crew.placing.endsAt - now) / 1000))}s
            </span>
          </span>
        )}
      </header>
      <div className="relative min-h-0 flex-1">
        <LiveTower
          team={team}
          fit="reach"
          predict={placingHere && controls ? () => controls.target() : undefined}
        />
        {children}
        {dazed && (
          <div
            className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center"
            role="status"
          >
            <div className="candy-stripes rounded-xl p-1 shadow-xl">
              <div className="rounded-lg bg-ink px-4 py-2 text-center">
                <div className="font-display text-lg text-sun">DAZED</div>
                <div className="text-xs text-cloud">
                  {(((crew.dazedUntil ?? now) - now) / 1000).toFixed(1)}s
                </div>
              </div>
            </div>
          </div>
        )}
        {crew.toppingUntil !== null && (
          <div
            className="pointer-events-none absolute inset-x-0 top-12 flex justify-center"
            role="status"
          >
            <div className="rounded-xl bg-sun px-4 py-1.5 font-display text-ink shadow-xl">
              TOPPING OUT… {Math.max(0, Math.ceil((crew.toppingUntil - now) / 1000))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
