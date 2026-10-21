import type { ReactNode } from 'react';

/** The knob's spring: it overshoots a little and settles, like a block landing. */
const SPRING = 'duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]';

/**
 * An on/off switch in the game's look: an outlined pill (grass when on, pebble when off) with a
 * chunky block for a knob that springs across and tips over to its side. `knob` puts something on
 * the block (an emoji), and `onText`/`offText` label the track ("ON"/"OFF" unless given).
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  knob,
  onText = 'ON',
  offText = 'OFF',
  onTrack = 'bg-grass',
  offTrack = 'bg-pebble',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** What it switches, for screen readers. */
  label: string;
  disabled?: boolean;
  knob?: ReactNode;
  onText?: string;
  offText?: string;
  onTrack?: string;
  offTrack?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-9 w-[4.5rem] shrink-0 items-center rounded-full border-[3px] border-ink shadow-[inset_0_3px_0_oklch(0_0_0/0.15),0_3px_0_var(--color-card-edge)] transition-colors select-none enabled:cursor-pointer enabled:active:translate-y-px disabled:cursor-default ${checked ? onTrack : offTrack}`}
    >
      <span
        aria-hidden="true"
        className={`absolute font-display text-[11px] tracking-wider text-cloud [text-shadow:0_1px_0_oklch(0_0_0/0.3)] ${checked ? 'left-2.5' : 'right-2'}`}
      >
        {checked ? onText : offText}
      </span>
      <span
        aria-hidden="true"
        className={`absolute top-1/2 left-0 flex size-7 -translate-y-1/2 items-center justify-center rounded-[9px] border-[3px] border-ink bg-sun text-sm leading-none shadow-[0_2px_0_var(--color-sun-dark)] transition-transform ${SPRING} ${checked ? 'translate-x-[2.25rem] rotate-6' : 'translate-x-[1px] -rotate-6'}`}
      >
        <span className="absolute top-[3px] left-[3px] h-[3px] w-2.5 rounded-full bg-white/70" />
        {knob}
      </span>
    </button>
  );
}
