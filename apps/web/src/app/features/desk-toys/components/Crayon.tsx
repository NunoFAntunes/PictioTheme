import { useRef, useState } from 'react';
import { DOODLES } from '../doodles';
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
import { Layer, Prop } from './Prop';

/* A crayon: rolls a little and scribbles one of the desk's doodles beside its tip. */

type Scribble = { id: number; paths: string[]; x: number; y: number; size: number; rotate: number };

const CRAYON_BOX: ViewBox = [0, 0, 200, 40];
const ALL_DOODLES = Object.values(DOODLES).flat();

/** Where a crayon's doodles go, in turn: along the part of it on the desk, above or below it. */
const SCRIBBLE_XS = [122, 168, 214];

export function Crayon(props: {
  place: Placement;
  color: string;
  shade: string;
  /** Which side of the crayon it doodles on: -1 above, 1 below (the crayons lie close together). */
  side: -1 | 1;
}) {
  const [scribbles, setScribbles] = useState<Scribble[]>([]);
  const body = useRef<SVGGElement>(null);
  const turn = useRef(0);

  function scribble() {
    play(
      body.current,
      [
        { transform: 'translateY(0) rotate(0deg)' },
        { transform: 'translateY(-6px) rotate(-2deg)' },
        { transform: 'translateY(3px) rotate(1deg)' },
        { transform: 'translateY(-1px) rotate(0deg)' },
        { transform: 'translateY(0) rotate(0deg)' },
      ],
      { duration: 500, easing: 'ease-out' },
    );
    const doodle = pick(ALL_DOODLES);
    const size = between(40, 52);
    const x = (SCRIBBLE_XS[turn.current++ % SCRIBBLE_XS.length] as number) + between(-6, 6);
    const y = props.side < 0 ? -size - between(2, 12) : 40 + between(2, 12);
    const fresh = { id: nextId(), paths: doodle.paths, x, y, size, rotate: between(-20, 20) };
    setScribbles((s) => [...s, fresh].slice(-SCRIBBLE_XS.length));
    sound('cardDeal', 1.3, 0.4);
  }

  return (
    <Prop place={props.place} viewBox={CRAYON_BOX} anchor={[197, 20]}>
      <Layer viewBox={CRAYON_BOX}>
        {scribbles.map((s) => (
          <g
            key={s.id}
            data-testid="crayon-scribble"
            transform={`translate(${s.x} ${s.y}) scale(${s.size / 64}) rotate(${s.rotate} 32 32)`}
            fill="none"
            stroke={props.color}
            strokeWidth={(3.5 * 64) / s.size}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {s.paths.map((d) => (
              <path
                key={d}
                d={d}
                pathLength={1}
                className="[stroke-dasharray:1] motion-safe:animate-squiggle-draw"
              />
            ))}
          </g>
        ))}
      </Layer>
      <Layer viewBox={CRAYON_BOX} shadow>
        <g
          ref={body}
          data-testid="desk-crayon"
          className={TOY}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
          onPointerDown={scribble}
        >
          <rect x="8" y="6" width="160" height="28" rx="3" fill={props.color} />
          <path d="M168 8 L197 20 L168 32 Z" fill={props.shade} />
          <path
            d="M14 12 H163"
            stroke="#fff"
            strokeOpacity="0.4"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M34 6 l5 5 l-5 5 l5 5 l-5 5 l5 5 l-5 4 M138 6 l5 5 l-5 5 l5 5 l-5 5 l5 5 l-5 4"
            fill="none"
            strokeWidth="2"
          />
        </g>
      </Layer>
    </Prop>
  );
}
