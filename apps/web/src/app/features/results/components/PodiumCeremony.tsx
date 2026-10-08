import type { Award, PublicPlayer } from '@pictiotheme/protocol';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { StickerLetters } from '../../../ui/StickerLetters';
import { nameFont, playerHash } from '../../player-list';
import { playSound } from '../../sound';
import { arrangePodium, ENTERS_AT, MOVES, type Beat, type PodiumRank } from '../ceremony';
import { burstConfetti } from '../confetti';
import { useCeremony, type Cue } from '../use-ceremony';
import { PodiumFigure, type FigureMotion } from './PodiumFigure';

/**
 * The end of a match as a little ceremony (screens.md §6): the podium scribbles itself onto the
 * sheet, 3rd and 2nd hop on, a drumroll, the winner drops in with a crown and doodle confetti, the
 * crowd (4th and below) waves, and the awards are slapped onto their owners. Then the winner keeps
 * celebrating, last place keels over once, and a tap pokes anyone.
 *
 * It plays only when the match ends while you watch: catching up (joining, reconnecting) or
 * reduced motion shows the finished podium. Tapping it, or Skip, jumps there.
 */

const AWARD_LABEL: Record<Award['id'], string> = {
  fastest_guesser: '⚡ Fastest guesser',
  best_drawer: '🎨 Best drawer',
};

const ORDINAL: Record<PodiumRank, string> = { 1: '1st', 2: '2nd', 3: '3rd' };

/** The winner stands a little taller than 2nd and 3rd. */
const SCALE: Record<PodiumRank, number> = { 1: 1, 2: 0.82, 3: 0.82 };
const STEP_HEIGHT: Record<PodiumRank, number> = { 1: 1.25, 2: 0.95, 3: 0.7 };
const HATCH: Record<PodiumRank, string> = {
  1: 'var(--color-pop-sun)',
  2: 'var(--color-pop-teal)',
  3: 'var(--color-pop-tomato)',
};

const HOP = 'cubic-bezier(0.3, 0.7, 0.4, 1)';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function winnersLine(names: string[]): string {
  if (names.length <= 1) return `${names[0] ?? ''} wins!`;
  return `${names.slice(0, -1).join(', ')} & ${names.at(-1) ?? ''} win!`;
}

type Props = {
  /** Every player, in the server's ranking order. */
  players: PublicPlayer[];
  awards: Award[];
  roomCode: string;
  /** The match ended while we watched (not caught up from a snapshot). */
  live: boolean;
};

export function PodiumCeremony({ players, awards, roomCode, live }: Props) {
  const [reduced] = useState(prefersReducedMotion);
  const [intro] = useState(() => live && !reduced);
  const podium = useMemo(() => arrangePodium(players), [players]);
  const figures = useRef(new Map<string, HTMLButtonElement>());
  const layer = useRef<HTMLDivElement>(null);

  const onStep = (rank: PodiumRank) => podium.steps.find((s) => s.rank === rank)?.players ?? [];
  const owned = awards.filter((a) => players.some((p) => p.id === a.playerId));

  const burst = (id: string, count: number) => {
    const from = figures.current.get(id);
    if (layer.current && from && !reduced) burstConfetti(layer.current, from, count);
  };
  const shake = (id: string) =>
    figures.current
      .get(id)
      ?.animate(
        [
          { rotate: '0deg' },
          { rotate: '-7deg' },
          { rotate: '6deg' },
          { rotate: '-3deg' },
          { rotate: '0deg' },
        ],
        { duration: 380, easing: 'ease-in-out' },
      );

  // Sounds and confetti follow the same timeline as the animation (ceremony.ts).
  const onBeat = (beat: Beat, cue: Cue) => {
    switch (beat) {
      case 'podium':
        cue.sound('podiumScribble');
        break;
      case 'third':
      case 'second':
        onStep(beat === 'third' ? 3 : 2).forEach((_, i) =>
          cue.sound('podiumThump', i * MOVES.tieGap + MOVES.hopLands),
        );
        break;
      case 'drumroll':
        cue.sound('drumroll');
        break;
      case 'winner':
        cue.sound('cymbalCrash', MOVES.dropLands);
        cue.sound('winnerFanfare', MOVES.dropLands + 80);
        onStep(1).forEach((p, i) =>
          cue.later(i * MOVES.tieGap + MOVES.dropLands, () => burst(p.id, 42)),
        );
        break;
      case 'crowd':
        podium.crowd.forEach((_, i) => cue.sound('stickerPop', i * MOVES.waveGap + 300));
        break;
      case 'awards':
        owned.forEach((a, i) => {
          const lands = i * MOVES.slapGap + MOVES.slapLands;
          cue.sound('stickerPop', lands);
          cue.later(lands, () => shake(a.playerId));
        });
        break;
      case 'idle':
        break;
    }
  };
  const { at, settled, skip } = useCeremony(intro, onBeat);

  // Without the show (reduced motion), the results still arrive with their jingle.
  useEffect(() => {
    if (!live || intro) return;
    const timer = setTimeout(() => playSound('matchResults'), 0);
    return () => clearTimeout(timer);
  }, [live, intro]);

  const poke = (player: PublicPlayer, winner: boolean) => {
    if (!settled || reduced) return; // during the show, the tap skips it instead
    const el = figures.current.get(player.id);
    el?.animate(
      [
        { translate: '0 0', scale: '1' },
        { translate: '0 0', scale: '1.16 0.82', offset: 0.15 },
        { translate: '0 -28px', scale: '0.92 1.1', offset: 0.45 },
        { translate: '0 0', scale: '1.1 0.9', offset: 0.7 },
        { translate: '0 0', scale: '1' },
      ],
      { duration: 520, easing: HOP },
    );
    playSound('pokeBoing');
    if (winner) {
      el?.querySelector('[data-spin]')?.animate(
        [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(360deg)' }],
        { duration: 600, easing: 'ease-in-out' },
      );
      burst(player.id, 14);
    }
  };

  const tense = at('drumroll') && !at('winner') && !settled;
  const motionFor = (
    player: PublicPlayer,
    place: PodiumRank | 'crowd',
    i: number,
  ): FigureMotion => {
    const offsetMs = -(playerHash(player.id, roomCode) % 3600);
    const enterBeat: Beat = place === 'crowd' ? 'crowd' : ENTERS_AT[place];
    const base: FigureMotion = {
      hidden: !at(enterBeat),
      boilMs: reduced ? null : tense && place !== 'crowd' ? 110 : 375,
      offsetMs,
      lean: place === 2 ? '9deg' : place === 3 ? '-9deg' : undefined,
      dir: place === 2 || (place === 'crowd' && i % 2 === 0) ? -1 : 1,
    };
    if (reduced) return base;
    const sway = (delayMs: number) => `sway 3.6s ease-in-out ${delayMs}ms infinite`;
    if (settled) {
      if (place === 1) {
        return {
          ...base,
          act: 'podium-victory-hop 4.5s ease-in-out infinite',
          spin: 'podium-victory-spin 4.5s ease-in-out infinite',
        };
      }
      if (podium.last === player) {
        const { keelDelay, keel } = MOVES;
        return {
          ...base,
          // Last in the list, so it wins over the sway while it plays (the sway may already be
          // running from the show: a running animation keeps going when only its delay changes).
          act: `${sway(offsetMs)}, podium-keel ${keel}ms ${keelDelay}ms backwards`,
        };
      }
      return { ...base, act: sway(offsetMs) };
    }
    if (place === 'crowd') {
      const enter = `podium-enter-wave ${MOVES.wave}ms ${HOP} ${i * MOVES.waveGap}ms both`;
      return { ...base, enter, act: sway(offsetMs) };
    }
    if (place === 1) {
      return {
        ...base,
        enter: `podium-enter-drop ${MOVES.drop}ms linear ${i * MOVES.tieGap}ms both`,
      };
    }
    const enter = `podium-enter-hop ${MOVES.hop}ms ${HOP} ${i * MOVES.tieGap}ms both`;
    const act = at('winner')
      ? `podium-react ${MOVES.react}ms ease-out ${MOVES.dropLands}ms both, ${sway(MOVES.dropLands + MOVES.react)}`
      : at('drumroll')
        ? `podium-lean ${MOVES.lean}ms ease-out forwards, podium-tremble 80ms linear infinite`
        : sway(offsetMs);
    return { ...base, enter, act };
  };

  const figure = (player: PublicPlayer, place: PodiumRank | 'crowd', i: number, size: string) => (
    <PodiumFigure
      key={player.id}
      player={player}
      size={size}
      motion={motionFor(player, place, i)}
      crown={
        place === 1
          ? {
              hidden: !at('winner'),
              animation: settled
                ? undefined
                : `podium-crown-drop ${MOVES.crown}ms ${HOP} ${i * MOVES.tieGap + MOVES.dropLands + 80}ms both`,
            }
          : undefined
      }
      awards={owned
        .map((a, k) => ({ a, k }))
        .filter(({ a }) => a.playerId === player.id)
        .map(({ a, k }) => ({
          label: AWARD_LABEL[a.id],
          hidden: !at('awards'),
          animation: settled
            ? undefined
            : `podium-slap ${MOVES.slap}ms cubic-bezier(0.2, 0.8, 0.3, 1.2) ${k * MOVES.slapGap}ms both`,
        }))}
      awardSide={place === 2 ? 'left' : 'right'}
      register={(el) => {
        if (el) figures.current.set(player.id, el);
        else figures.current.delete(player.id);
      }}
      onPoke={() => poke(player, place === 1)}
    />
  );

  // The figures shrink to fit every step (ties widen theirs) on one row of the sheet.
  const units = podium.steps.reduce(
    (sum, s) => sum + Math.max(1, s.players.length) * (SCALE[s.rank] + 0.1) + 0.3,
    0,
  );
  const winners = winnersLine(onStep(1).map((p) => p.name));
  const teasing = at('drumroll') && !at('winner') && !settled;

  return (
    <div
      className="@container relative flex w-full flex-col items-center"
      style={{ '--fig': `min(7.5rem, ${(96 / units).toFixed(2)}cqi)` } as CSSProperties}
      onClick={settled ? undefined : skip}
    >
      {!settled && (
        <button
          type="button"
          onClick={skip}
          className="absolute top-0 right-0 z-10 font-hand text-lg text-ink/60 hover:text-ink"
        >
          Skip ▸
        </button>
      )}

      <div className="grid min-h-24 w-full place-items-center text-center *:[grid-area:1/1]">
        <p
          aria-hidden={!teasing}
          className="font-hand text-3xl text-ink"
          style={{
            visibility: teasing ? undefined : 'hidden',
            animation: teasing ? `podium-write ${MOVES.write}ms ease-out both` : undefined,
          }}
        >
          And the winner is…
        </p>
        {at('winner') && (
          <p className="font-logo leading-tight" style={{ fontSize: 'clamp(2rem, 7cqi, 3.5rem)' }}>
            <span className="sr-only">{winners}</span>
            <StickerLetters
              name={winners}
              align="center"
              pop={settled ? false : { stepMs: MOVES.letterGap, durationMs: MOVES.letters }}
            />
          </p>
        )}
      </div>

      <div className="inline-flex flex-col items-center">
        <ol aria-label="Podium" className="flex items-end justify-center">
          {podium.steps.map((step) => {
            const scale = SCALE[step.rank];
            const size = `calc(var(--fig) * ${scale})`;
            const count = Math.max(1, step.players.length);
            return (
              <li key={step.rank} className="flex flex-col items-center">
                <span className="sr-only">{ORDINAL[step.rank]} place</span>
                <div className="relative z-10 -mb-1 flex items-end justify-center gap-2">
                  {step.players.length > 0 ? (
                    step.players.map((p, i) => figure(p, step.rank, i, size))
                  ) : (
                    <Tumbleweed hidden={!at('third')} still={reduced} />
                  )}
                </div>
                <PodiumStep
                  rank={step.rank}
                  animate={!settled}
                  hidden={!at('podium')}
                  width={`calc(${count} * (${size} + 0.5rem) + 1.5rem)`}
                >
                  {step.players.length > 0 ? (
                    step.players.map((p) => (
                      <NameTag
                        key={p.id}
                        player={p}
                        roomCode={roomCode}
                        width={`calc(${size} + 0.5rem)`}
                      />
                    ))
                  ) : (
                    <span className="font-hand text-base text-ink/70">(nobody)</span>
                  )}
                </PodiumStep>
              </li>
            );
          })}
        </ol>
        <Ground animate={!settled} hidden={!at('podium')} />
      </div>

      {podium.crowd.length > 0 && (
        <ol
          aria-label="Everyone else"
          className="mt-5 flex flex-wrap items-end justify-center gap-x-5 gap-y-4"
        >
          {podium.crowd.map(({ player, rank }, i) => {
            const font = nameFont(player.id, roomCode);
            return (
              <li key={player.id} className="flex flex-col items-center gap-0.5">
                {figure(player, 'crowd', i, 'max(3rem, calc(var(--fig) * 0.6))')}
                <span
                  className="max-w-28 truncate leading-tight text-ink"
                  style={{
                    fontFamily: font.family,
                    fontSize: `${0.9 * font.scale}rem`,
                    visibility: at('crowd') ? undefined : 'hidden',
                  }}
                >
                  {player.name}
                </span>
                <span
                  className="font-logo text-xs text-ink/70 tabular-nums"
                  style={{ visibility: at('crowd') ? undefined : 'hidden' }}
                >
                  #{rank} · {player.score}
                  <span className="sr-only"> points</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div
        ref={layer}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-10 bottom-0 z-30 overflow-hidden"
      />
    </div>
  );
}

/** A step of the podium, scribbled on in ink and hatched in its colour, with its number. */
function PodiumStep({
  rank,
  width,
  animate,
  hidden,
  children,
}: {
  rank: PodiumRank;
  width: string;
  animate: boolean;
  hidden: boolean;
  children: ReactNode;
}) {
  const { draw } = MOVES;
  return (
    <div
      className="relative"
      style={{
        width,
        height: `calc(var(--fig) * ${STEP_HEIGHT[rank]} + 2.5rem)`,
        visibility: hidden ? 'hidden' : undefined,
      }}
    >
      <SketchRect seed={rank * 101} colour={HATCH[rank]} animate={animate} />
      <div className="absolute inset-0 flex flex-col items-center gap-0.5 pt-1">
        <span
          aria-hidden="true"
          className="inline-block font-logo leading-none text-paper [paint-order:stroke_fill] [-webkit-text-stroke:0.2em_var(--color-ink)]"
          style={{
            fontSize: 'calc(var(--fig) * 0.3 + 0.5rem)',
            animation: animate
              ? `sticker-pop 560ms cubic-bezier(0.34, 1.6, 0.64, 1) ${draw * 0.83}ms backwards`
              : undefined,
          }}
        >
          {rank}
        </span>
        <div
          className="flex justify-center gap-2"
          style={{
            animation: animate ? `podium-fade 400ms ease-out ${draw}ms backwards` : undefined,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function NameTag({
  player,
  roomCode,
  width,
}: {
  player: PublicPlayer;
  roomCode: string;
  width: string;
}) {
  const font = nameFont(player.id, roomCode);
  return (
    <div className="flex flex-col items-center gap-0.5" style={{ width }}>
      <span
        className="max-w-full truncate leading-tight text-ink [-webkit-text-stroke:0.035em_currentColor]"
        style={{ fontFamily: font.family, fontSize: `${font.scale}rem` }}
      >
        {player.name}
      </span>
      <span className="rounded-[45%_55%_50%_60%/60%_45%_55%_50%] border-2 border-ink bg-paper px-2 pt-0.5 pb-1 font-logo text-sm leading-none text-ink tabular-nums">
        {player.score}
        <span className="sr-only"> points</span>
      </span>
    </div>
  );
}

/** Seeded, so every client draws the same wobbles. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A rectangle drawn by hand: each side in four slightly crooked segments. */
function wobblyRect(w: number, h: number, random: () => number): string {
  const corners = [
    [2, h],
    [2, 2],
    [w - 2, 2],
    [w - 2, h],
    [2, h],
  ] as const;
  let d = '';
  for (let side = 0; side < 4; side++) {
    const [x0, y0] = corners[side] ?? [0, 0];
    const [x1, y1] = corners[side + 1] ?? [0, 0];
    for (let s = 0; s < 4; s++) {
      const first = side === 0 && s === 0;
      const jitter = () => (first ? 0 : (random() - 0.5) * 3.2);
      const x = x0 + ((x1 - x0) * s) / 4 + jitter();
      const y = y0 + ((y1 - y0) * s) / 4 + jitter();
      d += `${first ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
    }
  }
  return `${d}Z`;
}

/**
 * The step's outline, drawn on with a pen (twice, the second line lighter and a beat later), then
 * hatched in. Measured, so the ink keeps its width at any size.
 */
function SketchRect({ seed, colour, animate }: { seed: number; colour: string; animate: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const hatch = `hatch${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width: w, height: h } = entry.contentRect;
      setBox((old) => (old && Math.abs(old.w - w) < 1 && Math.abs(old.h - h) < 1 ? old : { w, h }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const outlines = box && [
    wobblyRect(box.w, box.h, rng(seed)),
    wobblyRect(box.w, box.h, rng(seed + 7)),
  ];
  const { draw } = MOVES;
  return (
    <svg ref={ref} aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
      <defs>
        <pattern
          id={hatch}
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-35)"
        >
          <rect width="7" height="7" fill={colour} />
          <line
            x1="1"
            y1="0"
            x2="1"
            y2="7"
            stroke="var(--color-ink)"
            strokeOpacity="0.16"
            strokeWidth="1.5"
          />
        </pattern>
      </defs>
      {outlines && (
        <>
          <path
            d={outlines[0]}
            fill={`url(#${hatch})`}
            style={{
              animation: animate
                ? `podium-fade 430ms ease-out ${draw * 0.73}ms backwards`
                : undefined,
            }}
          />
          {outlines.map((d, i) => (
            <path
              key={i}
              d={d}
              pathLength={1}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth={i ? 1.6 : 3}
              strokeOpacity={i ? 0.55 : 1}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={
                animate
                  ? {
                      strokeDasharray: 1,
                      animation: `podium-draw ${draw}ms ease-out ${i * 210}ms both`,
                    }
                  : undefined
              }
            />
          ))}
        </>
      )}
    </svg>
  );
}

/** The line the podium stands on, written left to right with the steps. */
function Ground({ animate, hidden }: { animate: boolean; hidden: boolean }) {
  return (
    <svg
      viewBox="0 0 300 10"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="-mt-0.5 h-2.5 w-[calc(100%+3rem)] overflow-visible"
      style={{
        visibility: hidden ? 'hidden' : undefined,
        animation: animate ? `podium-write ${MOVES.draw}ms ease-out both` : undefined,
      }}
    >
      <path
        d="M0 5 L30 6 L60 4.5 L90 5.5 L120 4 L150 5.5 L180 4.8 L210 6 L240 4.5 L270 5.4 L300 5"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="3"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Rolls across the empty 3rd step of a two-player match. */
function Tumbleweed({ hidden, still }: { hidden: boolean; still: boolean }) {
  return (
    <div className="relative h-11 w-[calc(var(--fig)*0.82+2rem)]" aria-hidden="true">
      <svg
        viewBox="0 0 32 32"
        className="absolute bottom-0.5 left-1/2 -ml-4 size-8 overflow-visible fill-none stroke-[oklch(0.55_0.08_70)] stroke-2"
        style={{
          visibility: hidden ? 'hidden' : undefined,
          animation: still ? undefined : 'podium-tumble 5.5s linear infinite',
        }}
      >
        <path d="M27 16 a11 8 20 1 1 0 0.1 M24 13 a9 10 120 1 1 0 0.1 M22 18 a7 9 60 1 1 0 0.1 M26 15 a12 6 150 1 1 0 0.1 M20 16 a5 7 90 1 1 0 0.1" />
      </svg>
    </div>
  );
}
