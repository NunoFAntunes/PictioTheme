import { useLayoutEffect, useRef, type RefObject } from 'react';
import { overtakers, type Ranked } from './leaderboard';

const SLIDE_MS = 600;
const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
/** Around a frameless doodle a ring would be a stray box; a glow follows its outline instead. */
const GLOW = 'drop-shadow(0 0 6px var(--color-pop-sun))';

type Spot = { x: number; y: number };

/**
 * Slides rows (`data-player-id` children of `list`) from their old spot to their new one (FLIP)
 * when the order changes, up and down a column or across a wrapping grid. Whoever overtook someone
 * grows, wiggles and glows as they slide over the others.
 */
export function useLeaderboardMotion(
  list: RefObject<HTMLElement | null>,
  ranked: readonly Ranked<{ id: string }>[],
): void {
  const spots = useRef(new Map<string, Spot>());
  const ranks = useRef(new Map<string, number>());
  const signature = ranked.map((r) => `${r.player.id}:${r.rank}`).join(',');

  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const passed = overtakers(ranks.current, ranked);
    const origin = el.getBoundingClientRect();
    const nextSpots = new Map<string, Spot>();

    for (const row of el.querySelectorAll<HTMLElement>(':scope > [data-player-id]')) {
      const id = row.dataset.playerId;
      if (!id) continue;
      // Measured mid-animation this includes the transform, so a new slide starts where the row is.
      const rect = row.getBoundingClientRect();
      const spot = { x: rect.left - origin.left, y: rect.top - origin.top };
      nextSpots.set(id, spot);
      const before = spots.current.get(id);
      if (!animate || before === undefined) continue;
      const dx = before.x - spot.x;
      const dy = before.y - spot.y;
      if (passed.has(id)) {
        row.style.zIndex = '1';
        row
          .animate(
            [
              { transform: `translate(${dx}px, ${dy}px) scale(1)`, filter: 'none' },
              {
                transform: `translate(${dx * 0.65}px, ${dy * 0.65}px) scale(1.15) rotate(-6deg)`,
                filter: GLOW,
                offset: 0.35,
              },
              {
                transform: `translate(${dx * 0.3}px, ${dy * 0.3}px) scale(1.15) rotate(5deg)`,
                filter: GLOW,
                offset: 0.65,
              },
              { transform: 'none', filter: 'none' },
            ],
            { duration: SLIDE_MS, easing: EASING },
          )
          .finished.then(
            () => (row.style.zIndex = ''),
            () => (row.style.zIndex = ''),
          );
      } else if (dx !== 0 || dy !== 0) {
        row.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
          duration: SLIDE_MS,
          easing: EASING,
        });
      }
    }

    spots.current = nextSpots;
    ranks.current = new Map(ranked.map((r) => [r.player.id, r.rank]));
    // `signature` captures everything in `ranked` that matters here.
  }, [signature]);
}
