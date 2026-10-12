import { useLayoutEffect, useRef, useState } from 'react';
import {
  atRest,
  dropsIn,
  speed,
  step,
  throwVelocity,
  type Ball,
  type Basket,
  type Sample,
} from '../paper-ball';
import { between, INK, play, sound } from '../toy-kit';

/*
 * A crumpled paper ball and a wire wastebasket, seen from above: drag the ball and let go to
 * throw it (a tap just nudges it). It slides, bounces off the edges of the box it's in, and drops
 * in when it reaches the basket slowly; each basket from further than a step away is pencilled in
 * as a tally mark. Fills its nearest positioned box; `ballClassName` and `basketClassName` place
 * where the ball starts and the basket's middle in it (`left-[20%] top-[70%]`, container queries
 * welcome: they're read back from the page). Frames are moved straight on the DOM, outside React.
 */

/** A drop from closer than this many basket radii is a dunk: it goes in but doesn't count. */
const DUNK_REACH = 2;
const MAX_TALLY = 25;

type Game = {
  ball: Ball;
  /** How far it has rolled, as the ball's turn in degrees. */
  roll: number;
  frame: number;
  last: number;
  drag: { samples: Sample[]; dx: number; dy: number } | null;
  thrownFrom: { x: number; y: number } | null;
  sinking: boolean;
};

export function PaperBallGame({
  ballClassName,
  basketClassName,
}: {
  ballClassName: string;
  basketClassName: string;
}) {
  const [score, setScore] = useState(0);
  const [inBasket, setInBasket] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const ballEl = useRef<HTMLDivElement>(null);
  const basketEl = useRef<HTMLDivElement>(null);
  const basketSpot = useRef<HTMLDivElement>(null);
  const startSpot = useRef<HTMLDivElement>(null);
  const game = useRef<Game>({
    ball: { x: 0, y: 0, vx: 0, vy: 0 },
    roll: between(0, 360),
    frame: 0,
    last: 0,
    drag: null,
    thrownFrom: null,
    sinking: false,
  });

  function size() {
    const el = box.current;
    return {
      width: el?.clientWidth ?? 0,
      height: el?.clientHeight ?? 0,
      radius: (ballEl.current?.offsetWidth ?? 0) / 2,
    };
  }

  function basket(): Basket {
    return {
      x: basketSpot.current?.offsetLeft ?? 0,
      y: basketSpot.current?.offsetTop ?? 0,
      radius: (basketEl.current?.offsetWidth ?? 0) / 2,
    };
  }

  function render() {
    const { ball, roll } = game.current;
    const r = size().radius;
    if (ballEl.current) {
      ballEl.current.style.transform = `translate(${ball.x - r}px, ${ball.y - r}px) rotate(${roll}deg)`;
    }
  }

  function placeAtStart() {
    game.current.ball = {
      x: startSpot.current?.offsetLeft ?? 0,
      y: startSpot.current?.offsetTop ?? 0,
      vx: 0,
      vy: 0,
    };
    render();
  }

  // Lay the ball down once the box has a size, and keep it inside when the box changes.
  useLayoutEffect(() => {
    placeAtStart();
    const el = box.current;
    const g = game.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (g.drag || g.sinking) return;
      g.ball = step({ ...g.ball, vx: 0, vy: 0 }, 0, size()).ball;
      render();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(g.frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- laid down once, where it starts
  }, []);

  function run() {
    cancelAnimationFrame(game.current.frame);
    game.current.last = 0; // the first frame sets the clock
    game.current.frame = requestAnimationFrame(tick);
  }

  function tick(now: number) {
    const g = game.current;
    const dt = g.last === 0 ? 0 : Math.min((now - g.last) / 1000, 1 / 30);
    g.last = now;
    const dims = size();
    const moved = step(g.ball, dt, dims);
    g.ball = moved.ball;
    g.roll +=
      ((speed(g.ball) * dt) / Math.max(dims.radius, 1)) *
      (180 / Math.PI) *
      Math.sign(g.ball.vx || 1);
    if (moved.bounced > 200) {
      play(
        ballEl.current?.firstElementChild ?? null,
        [{ scale: '1' }, { scale: '0.82 1.12' }, { scale: '1' }],
        { duration: 180, easing: 'ease-out' },
      );
      sound('paperKick', 1.5, Math.min(0.35, moved.bounced / 4000));
    }
    const target = basket();
    if (dropsIn(g.ball, target)) {
      sink(target);
      return;
    }
    render();
    g.frame = atRest(g.ball) ? 0 : requestAnimationFrame(tick);
  }

  function sink(target: Basket) {
    const g = game.current;
    g.sinking = true;
    g.frame = 0;
    const from = g.thrownFrom;
    const counts =
      from !== null &&
      Math.hypot(from.x - target.x, from.y - target.y) > target.radius * DUNK_REACH;
    const r = size().radius;
    const fall = play(
      ballEl.current,
      [
        { transform: ballEl.current?.style.transform ?? '' },
        {
          transform: `translate(${target.x - r}px, ${target.y - r}px) rotate(${g.roll + 90}deg) scale(0.55)`,
          opacity: 0.6,
        },
      ],
      { duration: 280, easing: 'ease-in', fill: 'forwards' },
    );
    const landed = () => {
      fall?.cancel();
      setInBasket((n) => n + 1);
      if (counts) setScore((n) => n + 1);
      play(
        basketEl.current,
        [{ rotate: '0deg' }, { rotate: '-7deg' }, { rotate: '5deg' }, { rotate: '0deg' }],
        { duration: 380, easing: 'ease-out' },
      );
      sound('paperCrumple', 1.3, 0.35);
      if (counts) sound('stickerPop', 1.2, 0.5);
      g.sinking = false;
      g.thrownFrom = null;
      placeAtStart();
      play(ballEl.current?.firstElementChild ?? null, [{ scale: '0' }, { scale: '1' }], {
        duration: 380,
        easing: 'cubic-bezier(0.34, 1.6, 0.64, 1)',
      });
    };
    if (fall) fall.finished.then(landed, () => undefined);
    else landed();
  }

  function pointerAt(event: React.PointerEvent) {
    const rect = box.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  }

  function grab(event: React.PointerEvent<HTMLDivElement>) {
    const g = game.current;
    if (g.sinking) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    cancelAnimationFrame(g.frame);
    const p = pointerAt(event);
    g.drag = {
      samples: [{ ...p, t: event.timeStamp }],
      dx: g.ball.x - p.x,
      dy: g.ball.y - p.y,
    };
    g.ball = { ...g.ball, vx: 0, vy: 0 };
  }

  function drag(event: React.PointerEvent) {
    const g = game.current;
    if (!g.drag) return;
    const p = pointerAt(event);
    g.drag.samples = [...g.drag.samples, { ...p, t: event.timeStamp }].slice(-12);
    g.ball = step({ x: p.x + g.drag.dx, y: p.y + g.drag.dy, vx: 0, vy: 0 }, 0, size()).ball;
    render();
  }

  function letGo() {
    const g = game.current;
    if (!g.drag) return;
    const thrown = throwVelocity(g.drag.samples);
    g.drag = null;
    if (thrown) {
      g.ball = { ...g.ball, ...thrown };
      sound('paperKick', 1.2, 0.3);
    } else {
      // A tap: a little nudge somewhere.
      const angle = between(0, Math.PI * 2);
      const push = between(220, 420);
      g.ball = { ...g.ball, vx: Math.cos(angle) * push, vy: Math.sin(angle) * push };
      sound('paperCrumple', 2, 0.2);
    }
    g.thrownFrom = { x: g.ball.x, y: g.ball.y };
    run();
  }

  return (
    <div ref={box} className="pointer-events-none absolute inset-0">
      <div ref={startSpot} className={`absolute size-0 ${ballClassName}`} />
      <div ref={basketSpot} className={`absolute size-0 ${basketClassName}`}>
        <div
          ref={basketEl}
          data-testid="paper-basket"
          className="absolute -top-[2.4em] -left-[2.4em] size-[4.8em]"
        >
          <BasketDrawing balls={inBasket} />
        </div>
        <div className="absolute bottom-[2.8em] left-1/2 -translate-x-1/2">
          {score === 0 ? (
            <p className="font-hand text-[1.05em] whitespace-nowrap text-ink/45 -rotate-3">
              bin it from afar!
            </p>
          ) : (
            <Tally count={score} />
          )}
        </div>
      </div>
      <div
        ref={ballEl}
        data-testid="toy-paper-ball"
        className="pointer-events-auto absolute top-0 left-0 size-[2.4em] cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={grab}
        onPointerMove={drag}
        onPointerUp={letGo}
        onPointerCancel={letGo}
      >
        <PaperBallDrawing />
      </div>
    </div>
  );
}

function PaperBallDrawing() {
  return (
    <svg
      viewBox="0 0 40 40"
      className="size-full overflow-visible drop-shadow-[0_3px_2px_rgb(0_0_0/0.25)]"
    >
      <path
        d="M20 2 L29 5 L36 12 L38 21 L35 30 L27 37 L17 38 L9 34 L3 26 L2 16 L7 7 Z"
        fill="#fbfaf5"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M7 13 Q13 15 15 21 Q16 26 11 30 M19 5 Q21 12 28 15 M33 13 Q27 20 30 27 M15 21 Q22 21 25 29 M24 33 Q28 31 33 33"
        fill="none"
        stroke={INK}
        strokeOpacity="0.45"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 13 L16 9" stroke="var(--color-paper-line)" strokeWidth="2" />
      <path d="M20 31 L31 26" stroke="var(--color-paper-line)" strokeWidth="2" />
    </svg>
  );
}

/** Where the balls already in the basket lie, inside its opening. */
const PILE: [number, number, number][] = [
  [42, 56, 0],
  [58, 46, 40],
  [50, 38, 80],
  [36, 42, 120],
  [62, 60, 200],
  [48, 62, 260],
];

function BasketDrawing({ balls }: { balls: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className="size-full overflow-visible drop-shadow-[0_5px_4px_rgb(0_0_0/0.2)]"
    >
      <circle cx="50" cy="50" r="46" fill="#aeb4bf" stroke={INK} strokeWidth="3" />
      <circle cx="50" cy="50" r="38" fill="#6f7685" stroke={INK} strokeWidth="2.5" />
      {/* The wire mesh, seen down through the opening. */}
      <g stroke="#aeb4bf" strokeWidth="1.5" strokeOpacity="0.55">
        {[22, 32, 42, 50, 58, 68, 78].map((v) => (
          <path key={v} d={`M${v} 14 V86 M14 ${v} H86`} />
        ))}
      </g>
      <circle cx="50" cy="50" r="38" fill="none" stroke={INK} strokeWidth="2.5" />
      <path
        d="M17 32 A38 38 0 0 1 40 10"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.7"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {PILE.slice(0, balls).map(([x, y, turn]) => (
        <g
          key={`${x}-${y}`}
          transform={`translate(${x - 10} ${y - 10}) rotate(${turn} 10 10) scale(0.5)`}
        >
          <path
            d="M20 2 L29 5 L36 12 L38 21 L35 30 L27 37 L17 38 L9 34 L3 26 L2 16 L7 7 Z"
            fill="#fbfaf5"
            stroke={INK}
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </g>
      ))}
    </svg>
  );
}

/** Pencilled tally marks: four strokes, then one across them. */
function Tally({ count }: { count: number }) {
  const marks = Math.min(count, MAX_TALLY);
  const groups = Math.ceil(marks / 5);
  return (
    <svg
      data-testid="paper-ball-tally"
      data-count={count}
      viewBox={`0 0 ${groups * 34} 30`}
      className="h-[1.9em] -rotate-3 overflow-visible"
      style={{ width: `${(groups * 34 * 1.9) / 30}em` }}
      fill="none"
      stroke={INK}
      strokeOpacity="0.7"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      {Array.from({ length: marks }, (_, i) => {
        const g = Math.floor(i / 5) * 34;
        const k = i % 5;
        const d = k < 4 ? `M${g + 4 + k * 6} 4 L${g + 3 + k * 6} 26` : `M${g} 20 L${g + 28} 9`;
        return (
          <path
            key={i}
            d={d}
            pathLength={1}
            className="[stroke-dasharray:1] motion-safe:animate-squiggle-draw"
          />
        );
      })}
    </svg>
  );
}
