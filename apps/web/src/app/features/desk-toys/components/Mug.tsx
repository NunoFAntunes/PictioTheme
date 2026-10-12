import { useEffect, useRef, useState } from 'react';
import { between, INK, nextId, play, sound, TOY, type Placement, type ViewBox } from '../toy-kit';
import { Layer, Prop, Spawn } from './Prop';

/* A coffee mug, seen from above: it sloshes, the latte heart swirls, steam puffs up, and now and
 * then a drop spills. */

type Drip = { id: number; x: number; y: number; r: number };

const MUG_BOX: ViewBox = [0, 0, 200, 140];
const MUG_CENTRE = { transformBox: 'view-box', transformOrigin: '70px 70px' } as const;

/** `steam` is white over the desk; on paper, where white doesn't show, pass a darker wisp. */
export function Mug({ place, steam = '#fff' }: { place: Placement; steam?: string }) {
  const [sips, setSips] = useState(0);
  const [drips, setDrips] = useState<Drip[]>([]);
  const mug = useRef<SVGGElement>(null);
  const latte = useRef<SVGGElement>(null);

  function slosh() {
    play(
      mug.current,
      [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(-7deg) translate(-3px, 1px)' },
        { transform: 'rotate(5deg) translate(3px, -1px)' },
        { transform: 'rotate(-2deg)' },
        { transform: 'rotate(0deg)' },
      ],
      { duration: 480, easing: 'ease-out' },
    );
    play(
      latte.current,
      [
        { transform: 'rotate(0deg) scale(1)' },
        { transform: 'rotate(40deg) scale(0.85)' },
        { transform: 'rotate(-12deg) scale(1.05)' },
        { transform: 'rotate(0deg) scale(1)' },
      ],
      { duration: 1000, easing: 'ease-out' },
    );
    setSips((n) => n + 1);
    if (Math.random() < 0.6) {
      const angle = between(0, Math.PI * 2);
      const distance = between(68, 100);
      const drip = {
        id: nextId(),
        x: 70 + Math.cos(angle) * distance,
        y: 70 + Math.sin(angle) * distance,
        r: between(3, 7),
      };
      setDrips((d) => [...d, drip].slice(-12));
    }
    sound('fillGlug', 1.5, 0.35);
  }

  return (
    <Prop place={place} viewBox={MUG_BOX} anchor={[70, 70]}>
      <Layer viewBox={MUG_BOX}>
        {drips.map((d) => (
          <Spawn key={d.id} fromX={70 - d.x} fromY={70 - d.y}>
            <circle cx={d.x} cy={d.y} r={d.r} fill="#6b3f26" fillOpacity="0.8" />
          </Spawn>
        ))}
      </Layer>
      <Layer viewBox={MUG_BOX} shadow>
        <g ref={mug} data-testid="toy-mug" className={TOY} style={MUG_CENTRE} onPointerDown={slosh}>
          <path
            d="M118 52 Q168 48 168 70 Q168 92 118 88"
            fill="none"
            stroke={INK}
            strokeWidth="22"
            strokeLinecap="round"
          />
          <path
            d="M118 52 Q168 48 168 70 Q168 92 118 88"
            fill="none"
            stroke="#4cc9c0"
            strokeWidth="15"
            strokeLinecap="round"
          />
          <circle cx="70" cy="70" r="60" fill="#4cc9c0" stroke={INK} strokeWidth="3" />
          <path
            d="M22 52 A52 52 0 0 1 58 18"
            fill="none"
            stroke="#9be6df"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle cx="70" cy="70" r="47" fill="#6b3f26" stroke={INK} strokeWidth="3" />
          {sips > 0 && <Ripple key={sips} />}
          <g ref={latte} style={MUG_CENTRE}>
            <path
              d="M42 60 Q50 42 70 38"
              fill="none"
              stroke="#a8714b"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M72 92 C56 82 56 68 65 66 C69 65 72 68 72 72 C72 68 75 65 79 66 C88 68 88 82 72 92 Z"
              fill="#c89a6c"
            />
          </g>
        </g>
      </Layer>
      <Layer viewBox={MUG_BOX}>{sips > 0 && <Steam key={sips} color={steam} />}</Layer>
    </Prop>
  );
}

function Ripple() {
  const ref = useRef<SVGCircleElement>(null);
  useEffect(() => {
    play(
      ref.current,
      [
        { transform: 'scale(0.2)', opacity: 0.9 },
        { transform: 'scale(1)', opacity: 0 },
      ],
      { duration: 700, easing: 'ease-out', fill: 'forwards' },
    );
  }, []);
  return (
    <circle
      ref={ref}
      cx="70"
      cy="70"
      r="42"
      fill="none"
      stroke="#a8714b"
      strokeWidth="3"
      opacity="0"
      style={MUG_CENTRE}
    />
  );
}

function Steam({ color }: { color: string }) {
  const ref = useRef<SVGGElement>(null);
  useEffect(() => {
    play(
      ref.current,
      [
        { transform: 'translateY(0)', opacity: 0 },
        { transform: 'translateY(-20px)', opacity: 0.85, offset: 0.3 },
        { transform: 'translateY(-60px)', opacity: 0 },
      ],
      { duration: 1500, easing: 'ease-out', fill: 'forwards' },
    );
  }, []);
  return (
    <g ref={ref} opacity="0" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round">
      <path d="M55 40 q-8 -12 0 -22 q8 -10 0 -22" />
      <path d="M85 44 q-8 -12 0 -22 q8 -10 0 -22" />
    </g>
  );
}

/** The ring a mug leaves, multiplied into the paper under it like a real stain. */
export function CoffeeStain({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      className={`pointer-events-none absolute overflow-visible mix-blend-multiply ${className}`}
    >
      <g fill="none" stroke="#8a5a3a" strokeLinecap="round">
        <path d="M60 12 A48 48 0 1 1 18 84" strokeWidth="5" strokeOpacity="0.4" />
        <path d="M14 74 A48 48 0 0 1 52 13" strokeWidth="3" strokeOpacity="0.3" />
        <path d="M64 17 A43 43 0 0 1 102 52" strokeWidth="2" strokeOpacity="0.25" />
        <path d="M100 86 q8 6 12 14" strokeWidth="4" strokeOpacity="0.3" />
      </g>
    </svg>
  );
}
