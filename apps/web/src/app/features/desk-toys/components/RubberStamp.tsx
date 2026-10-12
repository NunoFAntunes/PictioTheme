import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  between,
  INK,
  nextId,
  play,
  reducedMotion,
  sound,
  TOY,
  type Placement,
  type ViewBox,
} from '../toy-kit';
import { Layer, Prop } from './Prop';

/*
 * A rubber stamp, seen from above (a wooden block, its knob on top): a press makes it hop to a
 * spot nearby, thump down and hop back, leaving a mark in smudgy red ink: WOW!, A+, a star…
 * It stamps the spots in `SPOTS` in turn, close around it (only the last five stay).
 */

type Mark = { id: number; x: number; y: number; rotate: number; design: number };

const STAMP_BOX: ViewBox = [0, 0, 100, 100];
const STAMP_INK = 'var(--color-pop-tomato)';
const HOP_MS = 820;
/** When in the hop it's pressed onto the paper. */
const PRESS_AT = 0.5;
/** Where the stamp goes down, from its centre, in turn (a little scattered each time): around it. */
const SPOTS: [number, number][] = [
  [-82, 10],
  [84, 30],
  [-60, 95],
  [70, 105],
  [-90, -40],
  [10, 120],
];
const MAX_MARKS = 5;
/** Marks are smaller than the stamp, so they fit around it. */
const MARK_SCALE = 0.62;

export function RubberStamp({ place }: { place: Placement }) {
  const [marks, setMarks] = useState<Mark[]>([]);
  const stamp = useRef<SVGGElement>(null);
  const turn = useRef(0);
  const busy = useRef(false);
  const press = useRef<ReturnType<typeof setTimeout>>(undefined);
  const roughId = `stamp-rough${useId().replace(/[^\w-]/g, '')}`;

  useEffect(() => () => clearTimeout(press.current), []);

  function thump() {
    if (busy.current) return;
    const [sx, sy] = SPOTS[turn.current++ % SPOTS.length] as [number, number];
    const dx = sx + between(-8, 8);
    const dy = sy + between(-8, 8);
    const at = (lift: number, x = dx, y = dy) => ({
      transform: `translate(${x}px, ${y}px) scale(${lift})`,
    });
    const leaveMark = () => {
      const mark = {
        id: nextId(),
        x: 50 + dx,
        y: 50 + dy,
        rotate: between(-18, 18),
        design: Math.floor(Math.random() * DESIGNS.length),
      };
      setMarks((m) => [...m, mark].slice(-MAX_MARKS));
      sound('podiumThump', 1.5, 0.35);
    };

    if (reducedMotion()) {
      leaveMark();
      return;
    }
    busy.current = true;
    play(
      stamp.current,
      [
        { ...at(1, 0, 0), offset: 0 },
        { ...at(1.2, dx * 0.3, dy * 0.3 - 30), offset: 0.2 },
        { ...at(1.25), offset: 0.38 },
        { ...at(0.92), offset: PRESS_AT },
        { ...at(1.1), offset: 0.64 },
        { ...at(1, 0, 0), offset: 1 },
      ],
      { duration: HOP_MS, easing: 'ease-in-out' },
    )?.finished.then(
      () => (busy.current = false),
      () => (busy.current = false),
    );
    press.current = setTimeout(leaveMark, HOP_MS * PRESS_AT);
  }

  return (
    <Prop place={place} viewBox={STAMP_BOX} anchor={[50, 50]}>
      <Layer viewBox={STAMP_BOX}>
        <defs>
          {/* Ink that took unevenly: the edges wobble a little. */}
          <filter id={roughId}>
            <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="3" />
            <feDisplacementMap in="SourceGraphic" scale="4" />
          </filter>
        </defs>
        <g
          fill="none"
          stroke={STAMP_INK}
          strokeWidth="5"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.8"
          filter={`url(#${roughId})`}
          className="mix-blend-multiply"
        >
          {marks.map((m) => (
            <g
              key={m.id}
              data-testid="stamp-mark"
              transform={`translate(${m.x} ${m.y}) rotate(${m.rotate}) scale(${MARK_SCALE})`}
            >
              {DESIGNS[m.design]}
            </g>
          ))}
        </g>
      </Layer>
      <Layer viewBox={STAMP_BOX} shadow>
        <g
          ref={stamp}
          data-testid="toy-stamp"
          className={TOY}
          style={{ transformBox: 'view-box', transformOrigin: '50px 50px' }}
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
          onPointerDown={thump}
        >
          {/* The rubber, peeking out under the block. */}
          <rect x="12" y="20" width="76" height="62" rx="6" fill={STAMP_INK} />
          <rect x="16" y="16" width="68" height="62" rx="6" fill="#c08552" />
          <path d="M22 30 H78 M22 64 H78" stroke="#a06a3e" strokeWidth="2" />
          <circle cx="50" cy="47" r="21" fill="var(--color-pop-purple)" />
          <circle cx="50" cy="47" r="13" fill="#a97cf0" stroke="none" />
          <path
            d="M39 40 A13 13 0 0 1 50 34"
            fill="none"
            stroke="#fff"
            strokeOpacity="0.7"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      </Layer>
    </Prop>
  );
}

/** A word in the stamp's lettering, centred on the mark. */
function Word({ children, size }: { children: string; size: number }) {
  return (
    <text
      x="0"
      y={size * 0.36}
      textAnchor="middle"
      fontSize={size}
      fontWeight="700"
      fill={STAMP_INK}
      stroke="none"
      style={{ fontFamily: 'var(--font-logo)' }}
    >
      {children}
    </text>
  );
}

/** The stamp's faces, each about 80 units wide, centred on 0,0. */
const DESIGNS: ReactNode[] = [
  <>
    <rect x="-46" y="-24" width="92" height="48" rx="10" />
    <Word size={24}>WOW!</Word>
  </>,
  <>
    <circle r="32" />
    <circle r="25" strokeWidth="2.5" />
    <Word size={26}>A+</Word>
  </>,
  <path d="M0 -36 L10 -12 L36 -11 L16 6 L23 32 L0 17 L-23 32 L-16 6 L-36 -11 L-10 -12 Z" />,
  <>
    <circle r="32" />
    <path d="M-12 -8 v4 M12 -8 v4 M-16 8 Q0 24 16 8" />
  </>,
  <>
    <rect x="-52" y="-22" width="104" height="44" rx="4" />
    <rect x="-46" y="-16" width="92" height="32" rx="2" strokeWidth="2.5" />
    <Word size={15}>GENIUS</Word>
  </>,
  <path d="M0 30 C-40 4 -34 -30 -12 -28 C-4 -27 0 -20 0 -14 C0 -20 4 -27 12 -28 C34 -30 40 4 0 30 Z" />,
  <>
    <rect x="-50" y="-22" width="100" height="44" rx="22" />
    <Word size={13}>NAILED IT</Word>
  </>,
];
