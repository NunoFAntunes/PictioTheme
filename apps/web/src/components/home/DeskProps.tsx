import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SoundId } from '../../app/features/sound';
import { DOODLES } from './doodles';

/*
 * Things lying on the desk around the home page's paper (screens.md §1), drawn like the logo's
 * pencil, their inner ends under the sheet. They're toys: the mug sloshes and spills, the eraser
 * rubs (click or scrub) and wears down into crumbs, the paintbrush wiggles and its splat grows,
 * and the crayons roll and scribble little doodles on the desk. Server-rendered, then hydrated.
 * Tablets in portrait have no desk beside the paper, so they show from 1024 px wide.
 */
export function DeskProps() {
  return (
    <div aria-hidden="true" className="pointer-events-none hidden select-none lg:block">
      <Mug />
      <Eraser />
      <Paintbrush />
      <Crayon
        color="#4cc9c0"
        shade="#2fa79e"
        className="-right-24 top-[42%]"
        rotate={-8}
        side={-1}
      />
      <Crayon
        color="#7ed957"
        shade="#58b532"
        className="-right-20 top-[57%]"
        rotate={12}
        side={1}
      />
    </div>
  );
}

const INK = 'var(--color-ink)';
const SHADOW = 'drop-shadow-[0_6px_5px_rgb(0_0_0/0.2)]';
const TOY = 'pointer-events-auto cursor-pointer';
const POP = 'cubic-bezier(0.34, 1.6, 0.64, 1)';

type ViewBox = [number, number, number, number];

/**
 * Places a drawing by one point of it (the mug's centre, the brush's tip): `className` positions
 * that point against the paper, `unit` is rem per viewBox unit, and it rotates around that point.
 */
function Prop(props: {
  className: string;
  viewBox: ViewBox;
  anchor: [number, number];
  unit: number;
  rotate: number;
  children: ReactNode;
}) {
  const [minX, minY, w, h] = props.viewBox;
  const ax = (props.anchor[0] - minX) * props.unit;
  const ay = (props.anchor[1] - minY) * props.unit;
  return (
    <div className={`absolute size-0 ${props.className}`}>
      <div
        className="absolute"
        style={{
          left: `${-ax}rem`,
          top: `${-ay}rem`,
          width: `${w * props.unit}rem`,
          height: `${h * props.unit}rem`,
          transformOrigin: `${ax}rem ${ay}rem`,
          rotate: `${props.rotate}deg`,
        }}
      >
        {props.children}
      </div>
    </div>
  );
}

/** One layer of a prop. Things lying flat (paint, coffee, crayon doodles) go in one without a shadow. */
function Layer({
  viewBox,
  shadow,
  children,
}: {
  viewBox: ViewBox;
  shadow?: boolean;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox={viewBox.join(' ')}
      className={`absolute inset-0 size-full overflow-visible ${shadow ? SHADOW : ''}`}
    >
      {children}
    </svg>
  );
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Plays a one-off animation on an SVG group; with reduced motion the change just happens. */
function play(el: Element | null, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
  if (el && !reducedMotion()) el.animate(keyframes, options);
}

/** The sound engine is loaded by the lobby; importing it lazily keeps it out of the server render. */
function sound(id: SoundId, rate: number, volume: number) {
  void import('../../app/features/sound').then((m) => m.playSound(id, { rate, volume }));
}

function between(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

let nextId = 0;

/** Something that appears on a click: it pops in, flung from `fromX`/`fromY` units away. */
function Spawn({ fromX, fromY, children }: { fromX: number; fromY: number; children: ReactNode }) {
  const ref = useRef<SVGGElement>(null);
  useEffect(() => {
    play(
      ref.current,
      [
        { transform: `translate(${fromX}px, ${fromY}px) scale(0.2)`, opacity: 0 },
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      ],
      { duration: 380, easing: POP },
    );
  }, [fromX, fromY]);
  return (
    <g ref={ref} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
      {children}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// Mug: sloshes, the latte heart swirls, steam puffs up, and now and then a drop spills.

type Drip = { id: number; x: number; y: number; r: number };

const MUG_BOX: ViewBox = [0, 0, 200, 140];
const MUG_CENTRE = { transformBox: 'view-box', transformOrigin: '70px 70px' } as const;

function Mug() {
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
        id: nextId++,
        x: 70 + Math.cos(angle) * distance,
        y: 70 + Math.sin(angle) * distance,
        r: between(3, 7),
      };
      setDrips((d) => [...d, drip].slice(-12));
    }
    sound('fillGlug', 1.5, 0.35);
  }

  return (
    <Prop
      className="left-6 -bottom-28"
      viewBox={MUG_BOX}
      anchor={[70, 70]}
      unit={0.075}
      rotate={150}
    >
      <Layer viewBox={MUG_BOX}>
        {drips.map((d) => (
          <Spawn key={d.id} fromX={70 - d.x} fromY={70 - d.y}>
            <circle cx={d.x} cy={d.y} r={d.r} fill="#6b3f26" fillOpacity="0.8" />
          </Spawn>
        ))}
      </Layer>
      <Layer viewBox={MUG_BOX} shadow>
        <g ref={mug} className={TOY} style={MUG_CENTRE} onPointerDown={slosh}>
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
      <Layer viewBox={MUG_BOX}>{sips > 0 && <Steam key={sips} />}</Layer>
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

function Steam() {
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
    <g ref={ref} opacity="0" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round">
      <path d="M55 40 q-8 -12 0 -22 q8 -10 0 -22" />
      <path d="M85 44 q-8 -12 0 -22 q8 -10 0 -22" />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// Eraser: rubs on a click or a scrub, wears down from its pink end, and leaves crumbs.

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

function Eraser() {
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
        id: nextId++,
        x,
        y,
        rotate: between(-60, 60),
        shape: CRUMB_SHAPES[Math.floor(Math.random() * CRUMB_SHAPES.length)] as string,
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
    <Prop
      className="left-8 -top-14"
      viewBox={ERASER_BOX}
      anchor={[79, 38]}
      unit={0.065}
      rotate={-16}
    >
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

// ---------------------------------------------------------------------------------------------
// Paintbrush: wiggles, flicks drops of paint, and its splat grows.

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

function Paintbrush() {
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
        id: nextId++,
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
    <Prop
      className="-right-6 -bottom-36"
      viewBox={BRUSH_BOX}
      anchor={[356, 30]}
      unit={0.07}
      rotate={52}
    >
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

// ---------------------------------------------------------------------------------------------
// Crayons: roll a little and scribble one of the desk's doodles beside their tip.

type Scribble = { id: number; paths: string[]; x: number; y: number; size: number; rotate: number };

const CRAYON_BOX: ViewBox = [0, 0, 200, 40];
const ALL_DOODLES = Object.values(DOODLES).flat();

/** Where a crayon's doodles go, in turn: along the part of it on the desk, above or below it. */
const SCRIBBLE_XS = [122, 168, 214];

function Crayon(props: {
  color: string;
  shade: string;
  className: string;
  rotate: number;
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
    const doodle = ALL_DOODLES[Math.floor(Math.random() * ALL_DOODLES.length)];
    if (doodle) {
      const size = between(40, 52);
      const x = (SCRIBBLE_XS[turn.current++ % SCRIBBLE_XS.length] as number) + between(-6, 6);
      const y = props.side < 0 ? -size - between(2, 12) : 40 + between(2, 12);
      const fresh = { id: nextId++, paths: doodle.paths, x, y, size, rotate: between(-20, 20) };
      setScribbles((s) => [...s, fresh].slice(-SCRIBBLE_XS.length));
    }
    sound('cardDeal', 1.3, 0.4);
  }

  return (
    <Prop
      className={props.className}
      viewBox={CRAYON_BOX}
      anchor={[197, 20]}
      unit={0.07}
      rotate={props.rotate}
    >
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
