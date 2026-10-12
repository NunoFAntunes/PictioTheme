import { useEffect, useRef, useState } from 'react';
import { FORTUNES } from '../fortunes';
import { between, INK, pick, play, reducedMotion, sound, TOY, type Placement } from '../toy-kit';

/*
 * A paper fortune teller (a cootie catcher), seen from above: its four pockets are the four
 * corners. A press works it a few times, opening one way then the other the way fingers do, and a
 * slip with a silly fortune pops out above it. It stays until the next go.
 */

type Corner = { x: 1 | -1; y: 1 | -1; color: string; dots: string };

const CORNERS: Corner[] = [
  { x: -1, y: -1, color: 'var(--color-pop-pink)', dots: '●' },
  { x: 1, y: -1, color: 'var(--color-pop-sun)', dots: '●●' },
  { x: -1, y: 1, color: 'var(--color-pop-teal)', dots: '●●●' },
  { x: 1, y: 1, color: '#a97cf0', dots: '●●●●' },
];
const PINCH_MS = 230;
/** How far a pocket moves when it opens, in viewBox units (the teller is 100 across). */
const GAP = 9;

export function FortuneTeller({ place }: { place: Placement }) {
  const [fortune, setFortune] = useState<{ text: string; tilt: number } | null>(null);
  const corners = useRef<(SVGGElement | null)[]>([]);
  const busy = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function work() {
    if (busy.current) return;
    busy.current = true;
    setFortune(null);
    const next = { text: pick(FORTUNES), tilt: between(-4, 4) };
    if (!reducedMotion()) {
      const pinches = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < pinches; i++) {
        const upDown = i % 2 === 0;
        sound('cardFlip', 1.6 + i * 0.05, 0.3);
        await Promise.all(
          CORNERS.map((c, j) => {
            const dx = upDown ? 0 : c.x * GAP;
            const dy = upDown ? c.y * GAP : 0;
            const run = play(
              corners.current[j] ?? null,
              [
                { transform: 'translate(0, 0)' },
                { transform: `translate(${dx}px, ${dy}px)` },
                { transform: 'translate(0, 0)' },
              ],
              { duration: PINCH_MS, easing: 'ease-in-out' },
            );
            return run ? run.finished.catch(() => undefined) : Promise.resolve();
          }),
        );
      }
    }
    busy.current = false;
    if (!alive.current) return;
    setFortune(next);
    sound('stickerPop', 1.1, 0.5);
  }

  const size = `${100 * place.unit}em`;
  return (
    <div
      className={`absolute size-0 ${place.className}`}
      style={{ viewTransitionName: place.transitionName }}
    >
      <div
        className="absolute"
        style={{
          width: size,
          height: size,
          left: `${-50 * place.unit}em`,
          top: `${-50 * place.unit}em`,
          rotate: `${place.rotate}deg`,
        }}
      >
        <svg
          viewBox="-20 -20 140 140"
          className="pointer-events-none absolute -inset-[20%] size-[140%] overflow-visible drop-shadow-[0_6px_5px_rgb(0_0_0/0.2)]"
        >
          <g
            data-testid="toy-fortune-teller"
            className={TOY}
            onPointerDown={() => void work()}
            stroke={INK}
            strokeWidth="2.5"
            strokeLinejoin="round"
          >
            {/* Inside, seen through the gaps: the folded-in flaps with fortunes under them. */}
            <rect x="12" y="12" width="76" height="76" fill="#e8e0cf" />
            <path d="M12 12 L88 88 M88 12 L12 88" strokeWidth="1.5" stroke="#b9ad94" />
            {CORNERS.map((c, j) => (
              <g
                key={c.color}
                ref={(el) => {
                  corners.current[j] = el;
                }}
              >
                <Pocket corner={c} />
              </g>
            ))}
          </g>
        </svg>
      </div>
      {fortune && (
        <div className="absolute left-0" style={{ bottom: `${62 * place.unit}em` }}>
          <p
            data-testid="fortune"
            className="pointer-events-none absolute bottom-0 left-0 w-[13em] -translate-x-1/2 rounded-sm border-2 border-ink bg-white px-2.5 py-1.5 text-center font-hand text-[1.05em] leading-tight text-ink shadow-[2px_3px_0_rgb(0_0_0/0.15)] motion-safe:animate-sticker-pop"
            style={{ rotate: `${fortune.tilt}deg` }}
          >
            {fortune.text}
          </p>
        </div>
      )}
    </div>
  );
}

/** One pocket: a quarter of the square, folded to a point at the middle, with its dots. */
function Pocket({ corner }: { corner: Corner }) {
  const ox = corner.x < 0 ? 0 : 100;
  const oy = corner.y < 0 ? 0 : 100;
  return (
    <>
      <path d={`M${ox} ${oy} L${ox} 50 L50 50 L50 ${oy} Z`} fill={corner.color} />
      {/* The crease from the corner to the middle, and the flap's highlight. */}
      <path d={`M${ox} ${oy} L50 50`} strokeWidth="1.5" strokeOpacity="0.6" />
      <path
        d={`M${(ox + 50) / 2} ${oy === 0 ? 4 : 96} L${ox === 0 ? 4 : 96} ${(oy + 50) / 2}`}
        stroke="#fff"
        strokeOpacity="0.5"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <text
        x={(ox + 50) / 2 + (ox === 0 ? 4 : -4)}
        y={(oy + 50) / 2 + (oy === 0 ? 6 : -2)}
        textAnchor="middle"
        fontSize="7"
        fill={INK}
        stroke="none"
        opacity="0.7"
      >
        {corner.dots}
      </text>
    </>
  );
}
