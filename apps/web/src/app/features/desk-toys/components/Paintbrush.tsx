import { useRef, useState } from 'react';
import { between, INK, nextId, play, sound, TOY, type Placement, type ViewBox } from '../toy-kit';
import { Layer, Prop, Spawn } from './Prop';

/* A paintbrush: wiggles, flicks drops of paint, and its splat grows. */

type Drop = { id: number; x: number; y: number; r: number; fromX: number; fromY: number };

const BRUSH_BOX: ViewBox = [0, 0, 380, 60];
const SPLAT = { x: 380, y: 34 };
const MAX_DABS = 8;
const STARTING_DROPS: Drop[] = [
  [419, 12, 4],
  [425, 52, 3],
  [341, 60, 3.5],
].map(([x, y, r], i) => ({
  id: -1 - i,
  x: x as number,
  y: y as number,
  r: r as number,
  fromX: 0,
  fromY: 0,
}));

export function Paintbrush({ place }: { place: Placement }) {
  const [dabs, setDabs] = useState(0);
  const [drops, setDrops] = useState(STARTING_DROPS);
  const brush = useRef<SVGGElement>(null);

  function flick() {
    play(
      brush.current,
      [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(-6deg)' },
        { transform: 'rotate(5deg)' },
        { transform: 'rotate(-3deg)' },
        { transform: 'rotate(1.5deg)' },
        { transform: 'rotate(0deg)' },
      ],
      { duration: 600, easing: 'ease-out' },
    );
    const reach = 1 + dabs * 0.12;
    const fresh: Drop[] = Array.from({ length: Math.random() < 0.5 ? 2 : 3 }, () => {
      const angle = between(0, Math.PI * 2);
      const distance = between(46, 80) * reach;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      return {
        id: nextId(),
        x: SPLAT.x + dx,
        y: SPLAT.y + dy,
        r: between(2, 5.5),
        fromX: -dx,
        fromY: -dy,
      };
    });
    setDrops((d) => [...d, ...fresh].slice(-36));
    setDabs((n) => Math.min(n + 1, MAX_DABS));
    sound('fillGlug', 0.9, 0.45);
  }

  return (
    <Prop place={place} viewBox={BRUSH_BOX} anchor={[356, 30]}>
      <Layer viewBox={BRUSH_BOX}>
        <g fill="var(--color-pop-purple)" className={TOY} onPointerDown={flick}>
          <g
            className="transition-transform duration-300 ease-[cubic-bezier(0.34,1.6,0.64,1)] motion-reduce:transition-none"
            style={{
              transform: `scale(${1 + dabs * 0.12})`,
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
          >
            <g transform="translate(333 -6)">
              <path d="M30 20 Q44 8 56 18 Q72 14 74 30 Q88 38 76 50 Q74 66 56 62 Q42 74 30 62 Q14 60 18 46 Q6 34 18 28 Q20 18 30 20 Z" />
              <path
                d="M30 28 Q40 20 50 24"
                fill="none"
                stroke="#fff"
                strokeOpacity="0.4"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </g>
          </g>
          {drops.map((d) => (
            <Spawn key={d.id} fromX={d.fromX} fromY={d.fromY}>
              <circle cx={d.x} cy={d.y} r={d.r} />
            </Spawn>
          ))}
        </g>
      </Layer>
      <Layer viewBox={BRUSH_BOX} shadow>
        <g
          ref={brush}
          className={TOY}
          style={{ transformBox: 'view-box', transformOrigin: '255px 30px' }}
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
          onPointerDown={flick}
        >
          <path d="M6 30 Q6 24 14 23 L232 18 V42 L14 37 Q6 36 6 30 Z" fill="#ff6b4a" />
          <path
            d="M18 26.5 L226 22"
            fill="none"
            stroke="#ffa48f"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <rect x="232" y="15" width="46" height="30" rx="3" fill="#c9ced6" />
          <path d="M244 15 V45 M254 15 V45" strokeWidth="2" />
          <path d="M278 17 Q318 12 348 26 Q360 30 348 34 Q318 48 278 43 Z" fill="#c08552" />
          <path
            d="M321 15.5 Q338 19 348 26 Q360 30 348 34 Q338 41 321 44.5 Q331 30 321 15.5 Z"
            fill="var(--color-pop-purple)"
          />
          <path d="M288 25 L318 26 M288 35 L318 34" strokeWidth="1.5" />
        </g>
      </Layer>
    </Prop>
  );
}
