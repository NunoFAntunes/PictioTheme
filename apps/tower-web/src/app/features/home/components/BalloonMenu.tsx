import { useEffect, useRef, useState, type ReactNode, type SubmitEvent } from 'react';
import { MEADOW } from '../../scenery';
import { playHomeCue } from '../../sound';
import { RISE_MS, useMenuFall } from '../menu-fall';
import { BalloonPop } from './BalloonPop';

/**
 * The three ways into a game as one toy (docs/tower/design/screens.md#1-home): a bunch of
 * balloons carrying a board, **Quick game**, with two planks hanging under it, **Private game**
 * and **Create a lobby**. It drifts and the planks swing, slowly, and everything holds still while
 * the pointer or focus is on it. Private game turns round on its strings to show the code field.
 * Picking a way in sends the whole bunch up into the sky while the game loads.
 *
 * Its balloons pop. Pop them all and the menu falls into the village, and the villagers build it
 * again (`menu-fall.ts`).
 *
 * Laid out in px (the game is for big screens, screens.md): the strings meet the board and the
 * planks at fixed points.
 */

export type WayIn = 'quick' | 'join' | 'create';

const WIDTH = 600;
const BOARD = { width: 380, height: 92 };
const PLANK = { width: 264, height: 76 };
/** Where the planks' centres hang, across the menu. */
const PLANK_X = [162, 438] as const;

const INK = 'var(--color-dusk-950)';
const STRING = 'oklch(0.35 0.03 265 / 0.8)';

/** The bunch: balloons around the knot at (300, 168). */
const BUNCH = [
  { x: 228, y: 92, r: 38, c: 0, d: 0 },
  { x: 372, y: 88, r: 40, c: 2, d: -1.1 },
  { x: 300, y: 46, r: 44, c: 1, d: -2.3 },
  { x: 258, y: 26, r: 34, c: 4, d: -0.6 },
  { x: 344, y: 30, r: 32, c: 3, d: -1.7 },
  { x: 300, y: 104, r: 36, c: 3, d: -2.8 },
] as const;
const KNOT = { x: 300, y: 168 };

function Bunch({
  popped,
  inflating,
  onPop,
}: {
  popped: ReadonlySet<number>;
  inflating: ReadonlySet<number>;
  onPop: (i: number, pan: number) => void;
}) {
  return (
    <svg
      aria-hidden="true"
      width={WIDTH}
      height={KNOT.y}
      viewBox={`0 0 ${WIDTH} ${KNOT.y}`}
      className="overflow-visible"
    >
      {BUNCH.map((b, i) =>
        popped.has(i) ? null : (
          <path
            key={`s${i}`}
            d={`M${b.x} ${b.y + b.r * 1.1}Q${(b.x + KNOT.x) / 2 + (i % 2 ? 8 : -8)} ${(b.y + KNOT.y) / 2 + 20} ${KNOT.x} ${KNOT.y}`}
            fill="none"
            stroke={STRING}
            strokeWidth={2}
          />
        ),
      )}
      {BUNCH.map((b, i) =>
        popped.has(i) ? (
          <BalloonPop
            key={`pop${i}`}
            cx={b.x}
            cy={b.y}
            r={b.r}
            color={MEADOW.balloons[b.c] ?? 'white'}
          />
        ) : (
          <g
            key={i}
            data-testid="menu-balloon"
            onPointerDown={(e) => onPop(i, (e.clientX / window.innerWidth) * 2 - 1)}
            className="pointer-events-auto cursor-pointer animate-balloon-bob"
            style={{
              animationDelay: `${b.d}s`,
              animationDuration: `${3 + (i % 3) * 0.6}s`,
              transformOrigin: `${b.x}px ${b.y + b.r * 1.1}px`,
              // The bob rises by 0.05em: a tenth of this balloon.
              fontSize: b.r * 2,
            }}
          >
            <g
              className={inflating.has(i) ? 'animate-inflate' : ''}
              style={{ transformBox: 'fill-box', transformOrigin: 'center bottom' }}
            >
              <ellipse
                cx={b.x}
                cy={b.y}
                rx={b.r * 0.88}
                ry={b.r}
                fill={MEADOW.balloons[b.c]}
                stroke={INK}
                strokeWidth={4}
              />
              <path
                d={`M${b.x} ${b.y + b.r * 0.95}l${-b.r * 0.16} ${b.r * 0.2}h${b.r * 0.32}Z`}
                fill={MEADOW.balloons[b.c]}
                stroke={INK}
                strokeWidth={3}
                strokeLinejoin="round"
              />
              <ellipse
                cx={b.x - b.r * 0.35}
                cy={b.y - b.r * 0.4}
                rx={b.r * 0.16}
                ry={b.r * 0.28}
                fill="white"
                opacity={0.55}
                transform={`rotate(30 ${b.x - b.r * 0.35} ${b.y - b.r * 0.4})`}
              />
            </g>
          </g>
        ),
      )}
    </svg>
  );
}

/** Where the strings meet a plank: this far in from its sides, and down from its top. */
const EYELET = { inset: 18, down: 8 };

/**
 * Strings from points on the top edge (`from`, x in this box) down to the eyelets of what hangs
 * under it, which overlaps the strings' bottom by `EYELET.down`.
 */
function Strings({
  width,
  height,
  from,
}: {
  width: number;
  height: number;
  from: [number, number];
}) {
  const { inset } = EYELET;
  return (
    <svg aria-hidden="true" width={width} height={height} className="block overflow-visible">
      <path
        d={`M${from[0]} 0L${inset} ${height}M${from[1]} 0L${width - inset} ${height}`}
        stroke={STRING}
        strokeWidth={2}
      />
    </svg>
  );
}

/**
 * The holes in a plank the strings go through. Part of the plank (not the strings), so they're
 * always on top of it and move with it when it's pressed. Inside its 3px border.
 */
function Eyelets() {
  const at = (side: 'left' | 'right') => ({
    [side]: EYELET.inset - 3 - 5,
    top: EYELET.down - 3 - 5,
  });
  return (
    <>
      {(['left', 'right'] as const).map((side) => (
        <span
          key={side}
          aria-hidden="true"
          className="absolute size-2.5 rounded-full border-[2.5px] border-dusk-950 bg-white"
          style={at(side)}
        />
      ))}
    </>
  );
}

const PLANK_FACE =
  'flex items-center justify-center rounded-2xl border-[3px] border-dusk-950 font-display tracking-wide transition select-none';

/** A swinging plank under the board, hung from `x` (its centre, across the menu). */
function Plank({ x, delay, children }: { x: number; delay: number; children: ReactNode }) {
  return (
    <div
      className="absolute top-0 origin-top animate-plank-sway hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]"
      style={{ left: x - PLANK.width / 2, width: PLANK.width, animationDelay: `${delay}s` }}
    >
      <Strings
        width={PLANK.width}
        height={40}
        from={[PLANK.width / 2 - 50, PLANK.width / 2 + 50]}
      />
      <div className="-mt-2" style={{ height: PLANK.height }}>
        {children}
      </div>
    </div>
  );
}

/** Private game: the plank turns round on its strings to show the code field. */
function PrivatePlank({
  busy,
  disabled,
  code,
  onCode,
  onJoin,
}: {
  busy: boolean;
  disabled: boolean;
  code: string;
  onCode: (code: string) => void;
  onJoin: () => void;
}) {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) input.current?.focus({ preventScroll: true });
  }, [open]);

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    onJoin();
  };

  return (
    <div className="h-full [perspective:900px]">
      <div
        className={`relative h-full transition-transform duration-500 [transform-style:preserve-3d] ${open ? '[transform:rotateY(180deg)]' : ''}`}
      >
        <button
          type="button"
          data-plank="Private game"
          aria-expanded={open}
          inert={open}
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={`${PLANK_FACE} absolute inset-0 bg-sun text-2xl text-sun-ink shadow-[0_6px_0_var(--color-sun-dark)] [backface-visibility:hidden] hover:brightness-105 active:translate-y-[5px] active:shadow-none`}
        >
          <Eyelets />
          Private game
        </button>
        <form
          inert={!open}
          onSubmit={submit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
          className={`${PLANK_FACE} absolute inset-0 gap-2 bg-sun px-2 shadow-[0_6px_0_var(--color-sun-dark)] [backface-visibility:hidden] [transform:rotateY(180deg)]`}
        >
          <Eyelets />
          <label htmlFor="room-code" className="sr-only">
            Room code or invite link
          </label>
          <input
            ref={input}
            id="room-code"
            value={code}
            onChange={(e) => onCode(e.target.value)}
            placeholder="ABC-DEF"
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-32 min-w-0 rounded-xl border-2 border-dusk-950/30 bg-paper px-2 text-center font-display text-lg tracking-[0.15em] text-ink uppercase outline-none placeholder:text-ink/30 focus:border-coral"
          />
          <button
            type="submit"
            disabled={disabled || code.length !== 7}
            className="h-11 rounded-xl bg-coral px-3 font-display text-lg text-cloud shadow-[0_4px_0_var(--color-coral-dark)] disabled:opacity-40 active:translate-y-[4px] active:shadow-none"
          >
            {busy ? '…' : 'Join'}
          </button>
          <button
            type="button"
            aria-label="Back"
            onClick={() => setOpen(false)}
            className="grid size-8 shrink-0 place-items-center rounded-full font-sans text-lg font-bold text-sun-ink/70 hover:bg-white/40"
          >
            ✕
          </button>
        </form>
      </div>
    </div>
  );
}

export function BalloonMenu({
  busy,
  code,
  onCode,
  onPick,
}: {
  /** The way in being loaded, while the bunch is up in the sky. */
  busy: WayIn | null;
  code: string;
  onCode: (code: string) => void;
  /** Returns false when it can't go yet (no name), so the bunch stays. */
  onPick: (way: WayIn) => boolean;
}) {
  // After a failed lift-off, the bunch floats back down.
  const [flown, setFlown] = useState(false);
  const away = busy !== null;
  if (away && !flown) setFlown(true);

  const nav = useRef<HTMLElement>(null);
  const { popped, inflating, phase, groundOffset, pop } = useMenuFall(nav, BUNCH.length);
  const usable = !away && phase === 'up';

  const pick = (way: WayIn) => {
    if (phase !== 'up') return;
    if (onPick(way)) playHomeCue('lift-off');
  };

  // Hanging lower and tilting towards the side with fewer balloons as they pop.
  const left = BUNCH.filter((_, i) => !popped.has(i));
  const balance = left.length ? left.reduce((sum, b) => sum + b.x - KNOT.x, 0) / left.length : 0;
  const hang =
    phase === 'up'
      ? { translate: `0 ${popped.size * 14}px`, rotate: `${(-balance / 100) * 6}deg` }
      : phase === 'rising'
        ? { translate: '0 0', rotate: '0deg' }
        : { translate: `0 ${groundOffset}px`, rotate: '0deg' };

  // The board hangs 48px under the knot; the planks' strings start just inside its bottom edge.
  const boardTop = KNOT.y + 48;
  const planksTop = boardTop + BOARD.height - 4;
  const height = planksTop + 40 + PLANK.height;

  return (
    <nav
      ref={nav}
      aria-label="Ways into a game"
      className={`relative ${away ? 'pointer-events-none animate-lift-off' : flown ? 'animate-float-back' : ''}`}
      style={{ width: WIDTH, height }}
    >
      <div
        inert={phase !== 'up'}
        className={`absolute inset-0 ${phase === 'fallen' ? 'invisible' : ''} ${phase === 'built' ? 'origin-bottom animate-inflate' : 'origin-top'}`}
        style={{
          ...hang,
          transition:
            phase === 'rising'
              ? `translate ${RISE_MS}ms ease-in-out`
              : phase === 'up'
                ? 'translate 500ms ease-out, rotate 600ms ease-out'
                : 'none',
        }}
      >
        <div className="absolute inset-0 origin-top animate-menu-sway hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]">
          <div className="absolute top-0 left-0">
            <Bunch popped={popped} inflating={inflating} onPop={pop} />
          </div>
          <div className="absolute" style={{ top: KNOT.y, left: (WIDTH - BOARD.width) / 2 }}>
            <Strings
              width={BOARD.width}
              height={56}
              from={[BOARD.width / 2 - 2, BOARD.width / 2 + 2]}
            />
            <button
              type="button"
              data-plank="Quick game"
              disabled={!usable}
              onClick={() => pick('quick')}
              className={`${PLANK_FACE} relative -mt-2 bg-coral text-4xl text-cloud shadow-[0_7px_0_var(--color-coral-dark)] [text-shadow:0_3px_0_var(--color-coral-dark)] hover:brightness-105 active:translate-y-[6px] active:shadow-none`}
              style={{ width: BOARD.width, height: BOARD.height }}
            >
              <Eyelets />
              {busy === 'quick' ? 'Finding a game…' : 'Quick game'}
            </button>
          </div>
          <div className="absolute inset-x-0" style={{ top: planksTop }}>
            <Plank x={PLANK_X[0]} delay={-1.5}>
              <PrivatePlank
                busy={busy === 'join'}
                disabled={!usable}
                code={code}
                onCode={onCode}
                onJoin={() => pick('join')}
              />
            </Plank>
            <Plank x={PLANK_X[1]} delay={-4}>
              <button
                type="button"
                data-plank="Create a lobby"
                disabled={!usable}
                onClick={() => pick('create')}
                className={`${PLANK_FACE} relative h-full w-full bg-card-light text-2xl text-ink shadow-[0_6px_0_var(--color-card-edge)] hover:bg-card-dark active:translate-y-[5px] active:shadow-none`}
              >
                <Eyelets />
                {busy === 'create' ? 'Getting ready…' : 'Create a lobby'}
              </button>
            </Plank>
          </div>
        </div>
      </div>
    </nav>
  );
}
