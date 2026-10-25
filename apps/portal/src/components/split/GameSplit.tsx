import {
  useEffect,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { warmUp } from '../../lib/warm-up';
import { GAMES, type Game } from '../../site';
import { DoodleWhirlPreview } from './DoodleWhirlPreview';
import { clipPaths, lineOffset } from './seam';
import { TowerPreview } from './TowerPreview';

/**
 * The portal's whole screen: the two games side by side (stacked on a phone), each a preview of
 * its own home page, split along a zig-zag line. Pointing well into one (past `DEAD_ZONE` from the
 * line) gives it a little more of the screen; pointing at one starts loading it; pressing it grows it over the other while it finishes loading,
 * then opens it (lib/warm-up.ts). The movement is global.css's `--split`.
 */

/** How long the pressed game takes to fill the screen before the page changes. */
const GROW_MS = 650;

/** How far from the line, as a share of the screen, the pointer has to go to move it. */
const DEAD_ZONE = 0.12;

const WIDE = clipPaths('wide');
const TALL = clipPaths('tall');

type Slot = 'first' | 'second';

/** The game the pointer is well into, measured from where the line rests (at half the screen). */
function leanOf(e: PointerEvent<HTMLElement>): Slot | null {
  const tall = matchMedia('(max-aspect-ratio: 4/5)').matches;
  const [across, along, size, length] = tall
    ? [e.clientY, e.clientX, innerHeight, innerWidth]
    : [e.clientX, e.clientY, innerWidth, innerHeight];
  const line = size * (0.5 + lineOffset(along / length) / 100);
  const past = (across - line) / size;
  return past < -DEAD_ZONE ? 'first' : past > DEAD_ZONE ? 'second' : null;
}

export function GameSplit() {
  const [going, setGoing] = useState<Slot | null>(null);
  const [lean, setLean] = useState<Slot | null>(null);

  // Back from a game (the page restored from the back/forward cache): both halves again.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setGoing(null);
    };
    addEventListener('pageshow', onShow);
    return () => removeEventListener('pageshow', onShow);
  }, []);

  const go = (slot: Slot, game: Game) => (e: MouseEvent<HTMLAnchorElement>) => {
    // A new tab or window keeps the portal as it is.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (going) return;
    warmUp(game.url, 'prerender');
    setGoing(slot);
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => location.assign(game.url), still ? 0 : GROW_MS);
  };

  return (
    <div
      className="split"
      data-going={going ?? undefined}
      // A finger has no hover: on a touch screen the line stays put until a game is pressed.
      onPointerMove={(e) => e.pointerType !== 'touch' && setLean(leanOf(e))}
      onPointerLeave={() => setLean(null)}
      style={
        {
          '--clip-first-wide': WIDE.first,
          '--clip-second-wide': WIDE.second,
          '--clip-first-tall': TALL.first,
          '--clip-second-tall': TALL.second,
        } as CSSProperties
      }
    >
      <Pane slot="first" game={GAMES[0]} active={lean === 'first'} onGo={go('first', GAMES[0])}>
        <DoodleWhirlPreview game={GAMES[0]} />
      </Pane>
      <Pane slot="second" game={GAMES[1]} active={lean === 'second'} onGo={go('second', GAMES[1])}>
        <TowerPreview game={GAMES[1]} />
      </Pane>
    </div>
  );
}

function Pane({
  slot,
  game,
  active,
  onGo,
  children,
}: {
  slot: Slot;
  game: Game;
  active: boolean;
  onGo: (e: MouseEvent<HTMLAnchorElement>) => void;
  children: ReactNode;
}) {
  return (
    <a
      href={game.url}
      className={`pane pane-${slot} focus-visible:outline-none`}
      data-active={active || undefined}
      onPointerEnter={() => warmUp(game.url, 'prefetch')}
      onFocus={() => warmUp(game.url, 'prefetch')}
      onPointerDown={() => warmUp(game.url, 'prerender')}
      onClick={onGo}
    >
      {children}
    </a>
  );
}
