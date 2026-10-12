import { useRef, useState } from 'react';
import {
  between,
  INK,
  nextId,
  pick,
  play,
  sound,
  TOY,
  type Placement,
  type ViewBox,
} from '../toy-kit';
import { Layer, Prop, Spawn } from './Prop';

/* An eraser: rubs on a click or a scrub, wears down from its pink end, and leaves crumbs. */

type Crumb = {
  id: number;
  x: number;
  y: number;
  rotate: number;
  shape: string;
  fromX: number;
  fromY: number;
};

const ERASER_BOX: ViewBox = [0, 0, 160, 76];
const CRUMB_SHAPES = ['q4 -4 8 0 q4 4 8 0', 'q3 -3 6 0', 'q3 4 7 1', 'q2 -4 6 -2', 'q4 -2 6 2'];
const MAX_WEAR = 50;
const STARTING_CRUMBS: Crumb[] = [
  [-14, 74, 10],
  [-26, 52, -30],
  [-6, 92, 40],
  [-34, 84, 0],
].map(([x, y, rotate], i) => ({
  id: -1 - i,
  x: x as number,
  y: y as number,
  rotate: rotate as number,
  shape: CRUMB_SHAPES[i % CRUMB_SHAPES.length] as string,
  fromX: 0,
  fromY: 0,
}));

export function Eraser({ place }: { place: Placement }) {
  const [wear, setWear] = useState(0);
  const [crumbs, setCrumbs] = useState(STARTING_CRUMBS);
  const body = useRef<SVGGElement>(null);
  const lastRub = useRef(0);
  const lastSound = useRef(0);

  function rub(event: React.PointerEvent) {
    if (event.type === 'pointermove' && event.buttons === 0) return; // scrubbing needs a press
    const now = performance.now();
    if (now - lastRub.current < 140) return;
    lastRub.current = now;

    play(
      body.current,
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-9px)' },
        { transform: 'translateX(7px)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 320, easing: 'ease-in-out' },
    );
    const end = 4 + wear; // the worn, pink end
    const fresh: Crumb[] = Array.from({ length: Math.random() < 0.5 ? 2 : 3 }, () => {
      const x = end - between(4, 44);
      const y = between(40, 100);
      return {
        id: nextId(),
        x,
        y,
        rotate: between(-60, 60),
        shape: pick(CRUMB_SHAPES),
        fromX: end - x,
        fromY: 38 - y,
      };
    });
    setCrumbs((c) => [...c, ...fresh].slice(-45));
    setWear((w) => Math.min(w + 2.5, MAX_WEAR));
    if (now - lastSound.current > 300) {
      lastSound.current = now;
      sound('cardShuffle', 1.9, 0.3);
    }
  }

  return (
    <Prop place={place} viewBox={ERASER_BOX} anchor={[79, 38]}>
      <Layer viewBox={ERASER_BOX} shadow>
        <g fill="none" stroke="#d98aa0" strokeWidth="3" strokeLinecap="round">
          {crumbs.map((c) => (
            <Spawn key={c.id} fromX={c.fromX} fromY={c.fromY}>
              <path
                data-testid="eraser-crumb"
                d={`M${c.x} ${c.y} ${c.shape}`}
                transform={`rotate(${c.rotate} ${c.x} ${c.y})`}
              />
            </Spawn>
          ))}
        </g>
        <g
          ref={body}
          data-testid="desk-eraser"
          className={`${TOY} touch-none`}
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
          onPointerDown={rub}
          onPointerMove={rub}
        >
          <rect x={4 + wear} y="8" width={150 - wear} height="60" rx="10" fill="#ff8fab" />
          <path d="M104 8 H144 A10 10 0 0 1 154 18 V58 A10 10 0 0 1 144 68 H104 Z" fill="#6ea8fe" />
          <rect
            x={10 + wear}
            y="12"
            width={138 - wear}
            height="9"
            rx="4.5"
            fill="#fff"
            fillOpacity="0.35"
            stroke="none"
          />
          <rect x={4 + wear} y="8" width={150 - wear} height="60" rx="10" fill="none" />
        </g>
      </Layer>
    </Prop>
  );
}
