import { useEffect, useRef, useState } from 'react';
import { between, INK, nextId, sound, TOY, type Placement, type ViewBox } from '../toy-kit';
import { Layer, Prop } from './Prop';

/*
 * A pencil, like the logo's, lying on the paper: a press spins it like a bottle, and it slows down
 * to point somewhere new. A whirl of pencil swooshes draws around it while it spins. Pressing again
 * while it's going spins it on.
 */

const PENCIL_BOX: ViewBox = [0, 0, 440, 44];
const CENTRE = { transformBox: 'view-box', transformOrigin: '220px 22px' } as const;
const SPIN_MS = 2600;

/** Arcs around the pencil's middle, drawn as it spins: the "whirl" of DoodleWhirl. */
const SWOOSHES = [
  'M220 -150 A172 172 0 0 1 392 22',
  'M220 194 A172 172 0 0 1 48 22',
  'M110 -96 A140 140 0 0 1 300 -92',
  'M330 140 A140 140 0 0 1 140 136',
];

export function SpinningPencil({ place }: { place: Placement }) {
  const [turn, setTurn] = useState(() => between(-30, 30));
  const [whirl, setWhirl] = useState<number | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(settle.current), []);

  function spin() {
    setTurn((t) => t + between(540, 1260));
    setWhirl(nextId());
    sound('cardShuffle', 1.4, 0.3);
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      setWhirl(null);
      sound('stickerPop', 0.8, 0.5);
    }, SPIN_MS);
  }

  return (
    <Prop place={place} viewBox={PENCIL_BOX} anchor={[220, 22]}>
      <Layer viewBox={PENCIL_BOX}>
        {whirl !== null && (
          <g
            key={whirl}
            fill="none"
            stroke="var(--color-pop-purple)"
            strokeOpacity="0.45"
            strokeWidth="7"
            strokeLinecap="round"
            className="motion-reduce:hidden"
          >
            {SWOOSHES.map((d, i) => (
              <path
                key={d}
                d={d}
                pathLength={1}
                className="[stroke-dasharray:1] motion-safe:animate-squiggle-draw"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            ))}
          </g>
        )}
      </Layer>
      <Layer viewBox={PENCIL_BOX} shadow>
        <g
          data-testid="toy-pencil"
          data-turn={Math.round(turn)}
          className={`${TOY} transition-transform ease-[cubic-bezier(0.12,0.75,0.2,1)] motion-reduce:transition-none`}
          style={{ ...CENTRE, transform: `rotate(${turn}deg)`, transitionDuration: `${SPIN_MS}ms` }}
          onPointerDown={spin}
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        >
          {/* A fatter hit area than the pencil, so it's easy to catch. */}
          <rect x="0" y="-14" width="440" height="72" fill="transparent" stroke="none" />
          <rect x="80" y="2" width="284" height="40" fill="#ffc93c" />
          <rect x="80" y="2" width="284" height="12" fill="#ffe07a" stroke="none" />
          <rect x="80" y="30" width="284" height="12" fill="#eaa61c" stroke="none" />
          <path d="M80 14H364M80 30H364" strokeWidth="2" />
          <rect x="80" y="2" width="284" height="40" fill="none" />
          <rect x="364" y="1" width="34" height="42" fill="#c9ced6" />
          <path d="M375 1V43M387 1V43" strokeWidth="2" />
          <path d="M398 2h24a16 16 0 0 1 16 16v8a16 16 0 0 1-16 16h-24z" fill="#ff8fab" />
          <path d="M24 15L80 2c-6 4-6 9 0 13c-6 4-6 10 0 14c-6 4-6 9 0 13L24 29z" fill="#f1c890" />
          <path d="M1 22L24 15v14z" fill={INK} />
        </g>
      </Layer>
    </Prop>
  );
}
