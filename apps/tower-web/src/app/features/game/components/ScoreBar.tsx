import { LINE_HEIGHTS, type Team } from '@pictiotheme/protocol/tower';
import { useServerNow, type RoomView } from '../../../realtime';
import { CREW_BG, CREW_NAME, CREW_TEXT } from '../../../ui/CrewBadge';

function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function HeightMeter({ team, view, mine }: { team: Team; view: RoomView; mine: boolean }) {
  const line = LINE_HEIGHTS[view.settings.line];
  const crew = view.crews[team];
  const share = Math.min(1, crew.height / line);
  const right = team === 'teal';
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-3 ${right ? 'flex-row-reverse' : ''}`}>
      <div className={`font-display text-sm tracking-wide ${CREW_TEXT[team]}`}>
        {CREW_NAME[team]}
        {mine && <span className="ml-1 text-cloud-dim">(you)</span>}
      </div>
      <div
        className="relative h-4 flex-1 overflow-hidden rounded-full bg-dusk-950"
        role="meter"
        aria-label={`${CREW_NAME[team]} tower height`}
        aria-valuemin={0}
        aria-valuemax={line}
        aria-valuenow={Math.round(crew.height * 10) / 10}
      >
        <div
          className={`absolute inset-y-0 transition-[width] duration-300 ${CREW_BG[team]} ${right ? 'right-0' : 'left-0'}`}
          style={{ width: `${share * 100}%` }}
        />
        {crew.toppingUntil !== null && (
          <div className="candy-stripes absolute inset-0 opacity-70" />
        )}
      </div>
      <div className="font-display text-sm tabular-nums" data-testid={`height-${team}`}>
        {crew.height.toFixed(1)} m
      </div>
    </div>
  );
}

/**
 * The race at a glance: both towers against the line, and the match's time limit. It stops short
 * on the right for the sound control.
 */
export function ScoreBar({ view, team }: { view: RoomView; team: Team }) {
  const now = useServerNow(500);
  return (
    <div className="mt-2 mr-16 mb-3 ml-3 flex items-center gap-4 rounded-2xl bg-dusk-900 px-4 py-2 shadow-[0_4px_0_var(--color-dusk-950)]">
      <HeightMeter team="orange" view={view} mine={team === 'orange'} />
      <div className="flex flex-col items-center px-2">
        <span className="font-display text-[10px] tracking-widest text-cloud-dim">
          TOP OUT {LINE_HEIGHTS[view.settings.line]} M
        </span>
        <span className="font-display text-lg tabular-nums">
          {view.matchEndsAt ? clock(view.matchEndsAt - now) : '–'}
        </span>
      </div>
      <HeightMeter team="teal" view={view} mine={team === 'teal'} />
    </div>
  );
}
