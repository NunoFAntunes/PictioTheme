import type { ReactNode } from 'react';
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  RotateLeftIcon,
  RotateRightIcon,
} from '../../../ui/icons';
import { KeyCap } from '../../../ui/KeyCap';
import type { PlacementController } from '../placement';

function ControlButton({
  label,
  onDown,
  onUp,
  children,
  wide,
  disabled,
}: {
  label: string;
  onDown: () => void;
  onUp?: () => void;
  children: ReactNode;
  wide?: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
      className={`grid h-11 place-items-center rounded-xl font-display text-lg select-none active:translate-y-1 active:shadow-none disabled:opacity-40 pointer-coarse:h-14 ${wide ? 'bg-coral px-5 text-cloud shadow-[0_4px_0_var(--color-coral-dark)]' : 'w-11 bg-ink text-cloud shadow-[0_4px_0_oklch(0.1_0.02_260)] pointer-coarse:w-14'}`}
    >
      {children}
    </button>
  );
}

/**
 * The placer's buttons (tablets) and keys (PCs), on the back of the play card. They're always
 * there, so the card doesn't jump; they only light up while you're placing.
 */
export function PlacingControls({
  controls,
  placing,
}: {
  controls: PlacementController;
  placing: boolean;
}) {
  const off = !placing;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-1.5">
        <ControlButton
          label="Move left"
          disabled={off}
          onDown={() => controls.hold('left', true)}
          onUp={() => controls.hold('left', false)}
        >
          <ArrowLeftIcon />
        </ControlButton>
        <ControlButton
          label="Move right"
          disabled={off}
          onDown={() => controls.hold('right', true)}
          onUp={() => controls.hold('right', false)}
        >
          <ArrowRightIcon />
        </ControlButton>
        <ControlButton label="Rotate left (Q)" disabled={off} onDown={() => controls.rotate(1)}>
          <RotateLeftIcon />
        </ControlButton>
        <ControlButton
          label="Rotate right (↑, W or E)"
          disabled={off}
          onDown={() => controls.rotate(-1)}
        >
          <RotateRightIcon />
        </ControlButton>
        <ControlButton
          label="Lower faster"
          disabled={off}
          onDown={() => controls.hold('fast', true)}
          onUp={() => controls.hold('fast', false)}
        >
          <ArrowDownIcon />
        </ControlButton>
        <ControlButton label="Drop" disabled={off} onDown={() => controls.drop()} wide>
          DROP
        </ControlButton>
      </div>
      <div
        className={`hidden flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-ink/70 pointer-fine:flex ${off ? 'opacity-50' : ''}`}
      >
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
          <KeyCap>
            <ArrowUpIcon />
          </KeyCap>{' '}
          rotate
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
    </div>
  );
}
