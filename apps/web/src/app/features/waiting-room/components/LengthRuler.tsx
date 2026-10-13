import { DRAW_SECONDS_RANGE, ROUNDS_RANGE, type RoomSettings } from '@pictiotheme/protocol';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
} from 'react';
import { playSound } from '../../sound';
import { lengthLabel, maxMatchMinutes } from '../match-length';

/**
 * The house rules' custom length: a wooden ruler the host slides over the Length choices. Rounds
 * are marked along its top edge and seconds to draw along its bottom one, each with a big marker
 * to slide along it (drag it, press the scale, or use the arrow keys). Pressing the embossed ✓
 * sends the numbers to the room and slides the ruler away; Escape or a press off the ruler puts
 * it away unchanged. Nothing goes to the room while the host slides, so the players see one
 * change.
 */

type Length = Pick<RoomSettings, 'rounds' | 'drawSeconds'>;

const SECONDS_STEP = 10;

const ROUNDS = range(ROUNDS_RANGE.min, ROUNDS_RANGE.max, 1);
const SECONDS = range(DRAW_SECONDS_RANGE.min, DRAW_SECONDS_RANGE.max, SECONDS_STEP);

function range(from: number, to: number, step: number): number[] {
  return Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
}

/** The step of `values` nearest to `value`. */
function nearest(values: readonly number[], value: number): number {
  return values.reduce((best, v) => (Math.abs(v - value) < Math.abs(best - value) ? v : best));
}

/** Boxwood: a warm gradient with fine grain running along the ruler. */
const WOOD: CSSProperties = {
  backgroundImage: [
    'repeating-linear-gradient(178deg, oklch(0.55 0.08 55 / 0.10) 0 1px, transparent 1px 5px, oklch(0.55 0.08 55 / 0.06) 5px 7px, transparent 7px 13px)',
    'linear-gradient(to bottom, oklch(0.88 0.08 78), oklch(0.81 0.1 68) 55%, oklch(0.76 0.1 62))',
  ].join(','),
};

/** The ✓ at the ruler's end, and the stroke of its ridge. */
const TICK = 'M3.5 11.5 9 17.5 20.5 4';
const RIDGE = {
  fill: 'none',
  strokeWidth: 5.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** Ink burnt into the wood: the marks, the numbers and what's set. */
const ENGRAVED = 'text-[oklch(0.38_0.07_50)] [text-shadow:0_1px_0_oklch(1_0_0/0.35)]';

export function LengthRuler({
  initial,
  players,
  wordChoice,
  closing,
  onConfirm,
  onCancel,
  onClosed,
}: {
  initial: Length;
  players: number;
  wordChoice: RoomSettings['wordChoice'];
  /** Sliding away: once it's gone, `onClosed`. */
  closing: boolean;
  onConfirm: (length: Length) => void;
  onCancel: () => void;
  onClosed: () => void;
}) {
  const [rounds, setRounds] = useState(() => nearest(ROUNDS, initial.rounds));
  const [drawSeconds, setDrawSeconds] = useState(() => nearest(SECONDS, initial.drawSeconds));
  const root = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLDivElement>(null);
  const confirm = () => onConfirm({ rounds, drawSeconds });

  useEffect(() => first.current?.focus({ preventScroll: true }), []);

  // A press anywhere off the ruler puts it away.
  useEffect(() => {
    if (closing) return;
    const away = (e: globalThis.PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) onCancel();
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [closing, onCancel]);

  const minutes = maxMatchMinutes({ rounds, drawSeconds, wordChoice }, players);

  return (
    <div
      ref={root}
      role="group"
      aria-label="Custom length"
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        onCancel();
      }}
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) onClosed();
      }}
      style={WOOD}
      className={`absolute -inset-x-2 top-0 z-30 h-[5.25rem] -rotate-1 rounded-[3px_5px_4px_3px] border-2 border-[oklch(0.45_0.07_50)] shadow-[2px_10px_16px_-6px_oklch(0.25_0.05_50/0.55),0_2px_3px_oklch(0.25_0.05_50/0.3)] ${
        closing
          ? 'pointer-events-none motion-safe:animate-ruler-out motion-reduce:animate-ruler-fade-out'
          : 'motion-safe:animate-ruler-in motion-reduce:animate-ruler-fade-in'
      }`}
    >
      {/* A bevel along the edges, where the light catches the wood. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_2px_0_oklch(1_0_0/0.4),inset_0_-2px_0_oklch(0.4_0.07_50/0.25)]"
      />

      <Scale
        side="top"
        label="Rounds"
        values={ROUNDS}
        value={rounds}
        onChange={setRounds}
        onConfirm={confirm}
        major={() => true}
        labelled={() => true}
        valueText={(n) => `${n} round${n === 1 ? '' : 's'}`}
        thumbRef={first}
        color="var(--color-pop-tomato)"
      />

      {/* What's set, engraved between the scales. */}
      <p
        aria-live="polite"
        className={`pointer-events-none absolute top-1/2 right-11 left-3 flex -translate-y-1/2 items-baseline justify-center gap-2 font-hand text-base leading-none whitespace-nowrap ${ENGRAVED}`}
      >
        {lengthLabel({ rounds, drawSeconds })}
        <span className="text-sm opacity-75">~{minutes} min</span>
      </p>

      <Scale
        side="bottom"
        label="Seconds to draw"
        values={SECONDS}
        value={drawSeconds}
        onChange={setDrawSeconds}
        onConfirm={confirm}
        major={(s) => s % 20 === 0}
        labelled={(s) => (s - DRAW_SECONDS_RANGE.min) % 40 === 0}
        valueText={(s) => `${s} seconds to draw`}
        color="var(--color-pop-teal)"
      />

      {/*
       * ✓ raised out of the wood at the end of the ruler, catching the light on its top edge and
       * casting a shadow below. Pointed at, it lifts and goes green; pressed, it sinks back.
       */}
      <button
        type="button"
        onClick={confirm}
        aria-label={`Use ${lengthLabel({ rounds, drawSeconds })}`}
        title="Use this length"
        className="group absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-[inherit] outline-none"
      >
        <svg
          viewBox="0 0 24 22"
          aria-hidden="true"
          className="h-7 w-8 overflow-visible transition-transform duration-150 ease-out group-hover:-translate-y-0.5 group-hover:scale-115 group-focus-visible:-translate-y-0.5 group-focus-visible:scale-115 group-active:translate-y-0 group-active:scale-100 motion-reduce:transition-none"
        >
          <path
            d={TICK}
            className="translate-x-[1.2px] translate-y-[2px] stroke-[oklch(0.2_0.06_50/0.8)] transition-transform duration-150 group-hover:translate-x-[1.5px] group-hover:translate-y-[3px] group-focus-visible:translate-x-[1.5px] group-focus-visible:translate-y-[3px] group-active:translate-x-[0.5px] group-active:translate-y-[0.5px]"
            {...RIDGE}
          />
          <path
            d={TICK}
            className="-translate-x-[0.8px] -translate-y-[1px] stroke-[oklch(0.99_0.03_90)]"
            {...RIDGE}
          />
          <path
            d={TICK}
            className="stroke-[oklch(0.52_0.12_55)] transition-[stroke] duration-150 group-hover:stroke-[oklch(0.68_0.15_150)] group-focus-visible:stroke-[oklch(0.68_0.15_150)]"
            {...RIDGE}
          />
        </svg>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 inset-y-3 rounded-md outline-2 outline-ink outline-dashed opacity-0 group-focus-visible:opacity-100"
        />
      </button>
    </div>
  );
}

const KEY_STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
  PageUp: 3,
  PageDown: -3,
  Home: -Infinity,
  End: Infinity,
};

/**
 * One edge of the ruler: its marks and numbers, and a marker to slide along them. Pressing
 * anywhere along the edge moves the marker there, and dragging slides it from mark to mark.
 */
function Scale({
  side,
  label,
  values,
  value,
  onChange,
  onConfirm,
  major,
  labelled,
  valueText,
  thumbRef,
  color,
}: {
  side: 'top' | 'bottom';
  label: string;
  values: readonly number[];
  value: number;
  onChange: (value: number) => void;
  onConfirm: () => void;
  major: (value: number) => boolean;
  labelled: (value: number) => boolean;
  valueText: (value: number) => string;
  thumbRef?: Ref<HTMLDivElement>;
  color: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  // Read by the pointer handlers, which may run again before the state re-renders.
  const held = useRef(false);
  const hold = (on: boolean) => {
    held.current = on;
    setDragging(on);
  };
  const index = Math.max(0, values.indexOf(value));
  const at = (i: number) => `${(i / (values.length - 1)) * 100}%`;
  const top = side === 'top';

  const set = (i: number) => {
    const next = values[Math.min(values.length - 1, Math.max(0, i))];
    if (next === undefined || next === value) return;
    playSound('rulerTick');
    onChange(next);
  };
  const toPointer = (e: PointerEvent) => {
    const box = track.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    set(Math.round(((e.clientX - box.left) / box.width) * (values.length - 1)));
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm();
      return;
    }
    const by = KEY_STEPS[e.key];
    if (by === undefined) return;
    e.preventDefault();
    set(Number.isFinite(by) ? index + by : by < 0 ? 0 : values.length - 1);
  };

  return (
    <div
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        hold(true);
        toPointer(e);
        e.currentTarget.querySelector<HTMLElement>('[role=slider]')?.focus({
          preventScroll: true,
        });
      }}
      onPointerMove={(e) => held.current && toPointer(e)}
      onPointerUp={() => hold(false)}
      onPointerCancel={() => hold(false)}
      className={`absolute right-12 left-4 h-8 touch-none ${top ? 'top-0' : 'bottom-0'} ${dragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
    >
      <div ref={track} className="absolute inset-x-0 inset-y-0">
        {values.map((v, i) => (
          <span key={v} aria-hidden="true">
            <span
              className={`absolute w-[1.5px] -translate-x-1/2 bg-[oklch(0.38_0.07_50/0.85)] ${top ? 'top-0' : 'bottom-0'} ${major(v) ? 'h-3' : 'h-1.5'}`}
              style={{ left: at(i) }}
            />
            {labelled(v) && (
              <span
                className={`absolute -translate-x-1/2 text-[0.65rem] leading-none font-semibold tabular-nums select-none ${ENGRAVED} ${top ? 'top-3' : 'bottom-3'}`}
                style={{ left: at(i) }}
              >
                {v}
              </span>
            )}
          </span>
        ))}

        <div
          ref={thumbRef}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-orientation="horizontal"
          aria-valuemin={values[0]}
          aria-valuemax={values[values.length - 1]}
          aria-valuenow={value}
          aria-valuetext={valueText(value)}
          onKeyDown={onKeyDown}
          style={{ left: at(index) }}
          className={`group absolute z-10 -translate-x-1/2 rounded-sm outline-none ${top ? '-top-3' : '-bottom-3'} ${dragging ? '' : 'transition-[left] duration-150 ease-out motion-reduce:transition-none'}`}
        >
          {/* A big marker, its point on the mark; a wider grip under it for fingers. */}
          <span aria-hidden="true" className="absolute -inset-x-2.5 -inset-y-1.5" />
          <svg
            viewBox="0 0 28 34"
            aria-hidden="true"
            className={`block h-[1.85rem] w-6 overflow-visible drop-shadow-[1px_2px_1px_oklch(0.25_0.05_50/0.45)] transition-transform group-focus-visible:scale-110 ${top ? '' : 'rotate-180'} ${dragging ? 'scale-110' : 'hover:scale-105'}`}
          >
            <path
              d="M4 2.5C10 1.5 18 1.5 24.5 2.5 25.5 9 25.5 15 25 20.5 21.5 25 18 28.5 14 32.5 10 28.5 6.5 25 3 20.5 2.5 15 2.8 9 4 2.5Z"
              fill={color}
              stroke="var(--color-ink)"
              strokeWidth={2.2}
              strokeLinejoin="round"
            />
            <path
              d="M8 7.5H20M8 11.5H20"
              stroke="oklch(1 0 0 / 0.55)"
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </svg>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-1 rounded-md outline-2 outline-ink outline-dashed opacity-0 group-focus-visible:opacity-100"
          />
        </div>
      </div>
    </div>
  );
}
