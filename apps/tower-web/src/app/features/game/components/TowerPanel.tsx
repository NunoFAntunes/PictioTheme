import type { Team } from '@pictiotheme/protocol/tower';
import type { ReactNode } from 'react';
import { useServerNow, type RoomView } from '../../../realtime';
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  RotateLeftIcon,
  RotateRightIcon,
} from '../../../ui/icons';
import { CREW_BG, CREW_NAME } from '../../../ui/CrewBadge';
import { KeyCap } from '../../../ui/KeyCap';
import { LiveTower } from '../../tower';
import type { PlacementController } from '../placement';

function ControlButton({
  label,
  onDown,
  onUp,
  children,
  wide,
}: {
  label: string;
  onDown: () => void;
  onUp?: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
      className={`grid h-11 place-items-center rounded-md font-display text-lg shadow-[0_2px_0_oklch(0_0_0/0.4)] select-none active:translate-y-0.5 pointer-coarse:h-14 ${wide ? 'bg-safety px-5 text-ink' : 'w-11 bg-blueprint-950/80 text-chalk pointer-coarse:w-14'}`}
    >
      {children}
    </button>
  );
}

/** The placer's on-screen controls (tablets), with the keys for PCs. */
function PlacingControls({ controls }: { controls: PlacementController }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-blueprint-700/70 bg-blueprint-950/85 px-3 py-2">
      <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 text-xs text-chalk-dim xl:flex">
        <span>
          <KeyCap>
            <ArrowLeftIcon />
          </KeyCap>{' '}
          <KeyCap>
            <ArrowRightIcon />
          </KeyCap>{' '}
          move
        </span>
        <span>
          <KeyCap>Q</KeyCap> <KeyCap>E</KeyCap> rotate
        </span>
        <span>
          <KeyCap>
            <ArrowDownIcon />
          </KeyCap>{' '}
          faster
        </span>
        <span>
          <KeyCap>Space</KeyCap> drop
        </span>
      </div>
      <div className="ml-auto flex gap-1.5">
        <ControlButton
          label="Move left"
          onDown={() => controls.hold('left', true)}
          onUp={() => controls.hold('left', false)}
        >
          <ArrowLeftIcon />
        </ControlButton>
        <ControlButton
          label="Move right"
          onDown={() => controls.hold('right', true)}
          onUp={() => controls.hold('right', false)}
        >
          <ArrowRightIcon />
        </ControlButton>
        <ControlButton label="Rotate left" onDown={() => controls.rotate(1)}>
          <RotateLeftIcon />
        </ControlButton>
        <ControlButton label="Rotate right" onDown={() => controls.rotate(-1)}>
          <RotateRightIcon />
        </ControlButton>
        <ControlButton
          label="Lower faster"
          onDown={() => controls.hold('fast', true)}
          onUp={() => controls.hold('fast', false)}
        >
          <ArrowDownIcon />
        </ControlButton>
        <ControlButton label="Drop" onDown={() => controls.drop()} wide>
          DROP
        </ControlButton>
      </div>
    </div>
  );
}

/**
 * One crew's tower with its status: the queue, who's placing and their time, a daze, topping out.
 * When you're the placer, it carries your controls.
 */
export function TowerPanel({
  team,
  view,
  controls,
  placingHere,
}: {
  team: Team;
  view: RoomView;
  /** The placer's controls, when you might be placing here. */
  controls?: PlacementController;
  /** You're placing on this tower. */
  placingHere: boolean;
}) {
  const now = useServerNow();
  const crew = view.crews[team];
  const placer = crew.placing ? view.players.find((p) => p.id === crew.placing?.placerId) : null;
  const dazed = crew.dazedUntil !== null && crew.dazedUntil > now;
  return (
    <section
      aria-label={`${CREW_NAME[team]} tower`}
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg border-2 border-blueprint-700 bg-blueprint-800/50"
    >
      <header className="z-10 flex items-center gap-2 border-b border-blueprint-700/70 bg-blueprint-950/85 px-3 py-1.5">
        <span className={`h-3 w-3 rounded-full ${CREW_BG[team]}`} aria-hidden="true" />
        <span className="font-display text-xs tracking-wide">{CREW_NAME[team]} tower</span>
        {crew.queue.length > 0 && (
          <span className="rounded bg-ply-light px-1.5 text-xs font-semibold text-ink">
            {crew.queue.length} waiting
          </span>
        )}
        {crew.placing && (
          <span className="ml-auto flex items-baseline gap-1.5 text-xs" role="timer">
            <span className="text-chalk-dim">
              {placingHere ? 'You’re placing' : `${placer?.name ?? '…'} placing`}
            </span>
            <span
              className={`w-7 text-right font-display text-sm tabular-nums ${crew.placing.endsAt - now < 5000 ? 'text-hazard' : ''}`}
            >
              {Math.max(0, Math.ceil((crew.placing.endsAt - now) / 1000))}s
            </span>
          </span>
        )}
      </header>
      <div className="relative min-h-0 flex-1">
        <LiveTower
          team={team}
          fit={placingHere ? 'reach' : 'platform'}
          predict={placingHere && controls ? () => controls.target() : undefined}
        />
        {dazed && (
          <div
            className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center"
            role="status"
          >
            <div className="hazard-stripes rounded-md p-1 shadow-xl">
              <div className="rounded bg-ink px-4 py-2 text-center">
                <div className="font-display text-lg text-hazard">DAZED</div>
                <div className="text-xs text-chalk">
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
            <div className="rounded-md bg-hazard px-4 py-1.5 font-display text-ink shadow-xl">
              TOPPING OUT… {Math.max(0, Math.ceil((crew.toppingUntil - now) / 1000))}
            </div>
          </div>
        )}
      </div>
      {placingHere && controls && <PlacingControls controls={controls} />}
    </section>
  );
}
