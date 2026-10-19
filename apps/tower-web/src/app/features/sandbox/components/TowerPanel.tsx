import { useEffect, useRef, type ReactNode } from 'react';
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  RotateLeftIcon,
  RotateRightIcon,
} from '../../../ui/icons';
import { KeyCap } from '../../../ui/KeyCap';
import { HUD_INSET, type Hud, type SandboxSession } from '../session';

/** A control that acts while held (move, lower faster), for touch and mouse. */
function HoldButton({
  label,
  keys,
  onHold,
  children,
}: {
  label: string;
  keys: string;
  onHold: (down: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={`${label} (${keys})`}
      title={`${label} (${keys})`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onContextMenu={(e) => e.preventDefault()}
      className="grid size-11 place-items-center rounded-md bg-blueprint-950/70 font-display text-lg text-chalk shadow-[0_2px_0_oklch(0_0_0/0.4)] select-none active:translate-y-0.5 active:bg-blueprint-700 pointer-coarse:size-14"
    >
      {children}
    </button>
  );
}

function TapButton({
  label,
  keys,
  onTap,
  children,
  wide,
}: {
  label: string;
  keys: string;
  onTap: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={`${label} (${keys})`}
      title={`${label} (${keys})`}
      onPointerDown={(e) => {
        e.preventDefault();
        onTap();
      }}
      className={`grid h-11 place-items-center rounded-md font-display text-lg shadow-[0_2px_0_oklch(0_0_0/0.4)] select-none active:translate-y-0.5 pointer-coarse:h-14 ${wide ? 'bg-safety px-5 text-ink' : 'w-11 bg-blueprint-950/70 text-chalk active:bg-blueprint-700 pointer-coarse:w-14'}`}
    >
      {children}
    </button>
  );
}

/** The tower view: the canvas the session draws on, with the HUD and the placement controls. */
export function TowerPanel({ session, hud }: { session: SandboxSession; hud: Hud }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return session.attach(canvas);
  }, [session]);

  const dazed = hud.dazedSeconds > 0;

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-lg border-2 border-blueprint-700 bg-blueprint-800/60 shadow-panel">
      <canvas
        ref={canvasRef}
        aria-label={`Tower, ${hud.height.toFixed(1)} metres high`}
        className="absolute inset-0 h-full w-full"
      />

      {/* HUD bar under the crane's jib: the queue, and the piece being placed with its time. */}
      <div
        className="absolute inset-x-0 top-7 flex items-center gap-3 border-b border-blueprint-700/70 bg-blueprint-950/80 px-3"
        style={{ height: HUD_INSET.top - 28 }}
      >
        <div
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
          aria-live="polite"
        >
          <span className="font-display text-[11px] tracking-widest text-chalk-dim">QUEUE</span>
          {hud.queue.length === 0 && <span className="text-xs text-chalk-dim">empty</span>}
          {hud.queue.slice(0, 5).map((word, i) => (
            <span
              key={`${word}-${i}`}
              className="shrink-0 rounded bg-ply-light px-2 py-0.5 text-xs font-semibold text-ink shadow"
            >
              {word}
            </span>
          ))}
          {hud.queue.length > 5 && (
            <span className="text-xs text-chalk-dim">+{hud.queue.length - 5}</span>
          )}
        </div>
        {hud.placing && (
          <div className="flex shrink-0 items-baseline gap-2" role="timer">
            <span className="text-xs text-chalk-dim">Placing</span>
            <span className="font-display text-sm text-chalk">{hud.placing.word}</span>
            <span
              className={`w-10 text-right font-display text-xl tabular-nums ${hud.placing.secondsLeft <= 5 ? 'text-hazard' : 'text-chalk'}`}
            >
              {Math.ceil(hud.placing.secondsLeft)}s
            </span>
          </div>
        )}
      </div>

      {dazed && (
        <div
          className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center"
          role="status"
        >
          <div className="hazard-stripes rounded-md p-1.5 shadow-xl">
            <div className="rounded bg-ink px-6 py-3 text-center">
              <div className="font-display text-2xl text-hazard">DAZED</div>
              <div className="text-sm text-chalk">
                A piece fell off. Placing resumes in {hud.dazedSeconds.toFixed(1)}s
              </div>
            </div>
          </div>
        </div>
      )}

      {hud.toppedOut && (
        <div
          className="pointer-events-none absolute inset-x-0 top-1/4 flex justify-center"
          role="status"
        >
          <div className="rounded-lg bg-hazard px-8 py-4 text-center text-ink shadow-2xl">
            <div className="font-display text-4xl">TOPPED OUT!</div>
            <div className="text-sm font-medium">
              {hud.placed} pieces placed · {hud.fumbles} fumbled
            </div>
          </div>
        </div>
      )}

      {!hud.ready && (
        <div className="absolute inset-0 grid place-items-center font-display text-chalk-dim">
          Raising the crane…
        </div>
      )}

      {/* Controls */}
      <div
        className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 border-t border-blueprint-700/70 bg-blueprint-950/80 px-3"
        style={{ height: HUD_INSET.bottom }}
      >
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
        <div className="ml-auto flex gap-1.5" aria-label="Placement controls">
          <HoldButton label="Move left" keys="← or A" onHold={(d) => session.hold('left', d)}>
            <ArrowLeftIcon />
          </HoldButton>
          <HoldButton label="Move right" keys="→ or D" onHold={(d) => session.hold('right', d)}>
            <ArrowRightIcon />
          </HoldButton>
          <TapButton label="Rotate left" keys="Q" onTap={() => session.rotate(1)}>
            <RotateLeftIcon />
          </TapButton>
          <TapButton label="Rotate right" keys="E" onTap={() => session.rotate(-1)}>
            <RotateRightIcon />
          </TapButton>
          <HoldButton label="Lower faster" keys="↓ or S" onHold={(d) => session.hold('fast', d)}>
            <ArrowDownIcon />
          </HoldButton>
          <TapButton label="Drop" keys="Space" onTap={() => session.drop()} wide>
            DROP
          </TapButton>
        </div>
      </div>
    </div>
  );
}
