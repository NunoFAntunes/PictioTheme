import { useLayoutEffect, useRef, type RefObject } from 'react';
import { overtakers, type Ranked } from './leaderboard';

const SLIDE_MS = 600;
const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/**
 * Slides rows (`data-player-id` children of `list`) from their old spot to their new one (FLIP)
 * when the order changes. Whoever overtook someone pops and slides over the others.
 */
export function useLeaderboardMotion(
  list: RefObject<HTMLElement | null>,
  ranked: readonly Ranked<{ id: string }>[],
): void {
  const tops = useRef(new Map<string, number>());
  const ranks = useRef(new Map<string, number>());
  const signature = ranked.map((r) => `${r.player.id}:${r.rank}`).join(',');

  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const passed = overtakers(ranks.current, ranked);
    const origin = el.getBoundingClientRect().top;
    const nextTops = new Map<string, number>();

    for (const row of el.querySelectorAll<HTMLElement>(':scope > [data-player-id]')) {
      const id = row.dataset.playerId;
      if (!id) continue;
      // Measured mid-animation this includes the transform, so a new slide starts where the row is.
      const top = row.getBoundingClientRect().top - origin;
      nextTops.set(id, top);
      const before = tops.current.get(id);
      if (!animate || before === undefined) continue;
      const dy = before - top;
      if (passed.has(id)) {
        row.style.zIndex = '1';
        row
          .animate(
            [
              { transform: `translateY(${dy}px) scale(1)`, boxShadow: 'none' },
              {
                transform: `translateY(${dy / 2}px) scale(1.06)`,
                boxShadow: '0 0 0 2px var(--color-brand-500)',
                offset: 0.5,
              },
              { transform: 'none', boxShadow: 'none' },
            ],
            { duration: SLIDE_MS, easing: EASING },
          )
          .finished.then(
            () => (row.style.zIndex = ''),
            () => (row.style.zIndex = ''),
          );
      } else if (dy !== 0) {
        row.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
          duration: SLIDE_MS,
          easing: EASING,
        });
      }
    }

    tops.current = nextTops;
    ranks.current = new Map(ranked.map((r) => [r.player.id, r.rank]));
    // `signature` captures everything in `ranked` that matters here.
  }, [signature]);
}
