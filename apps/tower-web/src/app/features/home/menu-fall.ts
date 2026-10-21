import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  backdropLayout,
  callBuilders,
  dismissBackdropBuilders,
  dropOnBackdrop,
  onBackdrop,
  type Drop,
} from '../scenery';
import { playHomeCue, playVillageCue } from '../sound';

/**
 * The balloon menu's balloons can be popped (docs/tower/design/screens.md#1-home). Each one gone
 * makes the menu sag and tilt; they all blow up again if you stop. Pop the last one and the board
 * and planks fall into the village behind the page (`scenery/backdrop-drops.ts`), squashing
 * whoever's under them, and the villagers break them up. Once the lane is clear, a few of them run
 * over and hammer the menu back together on the ground, its balloons blow up one by one, and it
 * floats back up to its place while they cheer.
 *
 * With reduced motion the scenery doesn't move, so nothing falls: the balloons just come back.
 */

export type MenuPhase =
  /** Hanging in the sky, usable. */
  | 'up'
  /** Fallen into the village: hidden while it's cleaned up and the builders arrive. */
  | 'fallen'
  /** Being put back together on the ground. */
  | 'built'
  /** Floating back up to its place. */
  | 'rising';

/** Balloons popped (but not all) blow up again after this long without another pop. */
const REGROW_MS = 5000;
/** If the village never says it's clear (the window was resized, say), rebuild anyway. */
const CLEAR_TIMEOUT_MS = 30_000;

/** The rebuild, in ms from when the lane is clear. */
const BUILDERS_ARRIVE = 1500;
const FIRST_BALLOON = BUILDERS_ARRIVE + 1100;
const BALLOON_EVERY = 300;
export const RISE_MS = 2000;

const ROUND_RADIUS = 16;

/** A picture of a plank or the board as it looks now: its base, face, outline and label. */
function snapshot(el: HTMLElement): Drop {
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  // The chunky base is the box shadow: "<colour> 0px 6px 0px 0px".
  const shadow = /^(.*\))\s+[-\d.]+px\s+([-\d.]+)px/.exec(style.boxShadow);
  const baseColor = shadow?.[1] ?? 'rgb(0 0 0 / 0.25)';
  const base = shadow ? parseFloat(shadow[2] ?? '0') : 0;
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * dpr);
  canvas.height = Math.ceil((height + base) * dpr);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.roundRect(0, base, width, height, ROUND_RADIUS);
    ctx.fill();
    ctx.fillStyle = style.backgroundColor;
    ctx.strokeStyle = style.borderTopColor;
    ctx.lineWidth = parseFloat(style.borderTopWidth) || 3;
    ctx.beginPath();
    ctx.roundRect(1.5, 1.5, width - 3, height - 3, ROUND_RADIUS);
    ctx.fill();
    ctx.stroke();
    ctx.font = `${style.fontSize} ${style.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = style.color;
    ctx.fillText(el.dataset.plank ?? '', width / 2, height / 2 + 1);
  }
  // Around its centre, as laid out (it may be swinging a little: near enough).
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  return {
    image: canvas,
    rect: { x: cx - width / 2, y: cy - height / 2, width, height: height + base },
  };
}

export function useMenuFall(menu: RefObject<HTMLElement | null>, count: number) {
  const [popped, setPopped] = useState<ReadonlySet<number>>(new Set());
  const [inflating, setInflating] = useState<ReadonlySet<number>>(new Set());
  const [phase, setPhase] = useState<MenuPhase>('up');
  const [groundOffset, setGroundOffset] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const regrow = useRef<ReturnType<typeof setTimeout>>(undefined);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };

  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
      clearTimeout(regrow.current);
    },
    [],
  );

  // The village's sounds, while it's the home page's.
  useEffect(
    () =>
      onBackdrop((event) => {
        if (event.kind === 'cue') playVillageCue(event.cue, { pan: event.pan });
      }),
    [],
  );

  /** Blows balloons up again, all at once. */
  const blowUp = (which: ReadonlySet<number>) => {
    if (!which.size) return;
    playHomeCue('inflate');
    setInflating(new Set(which));
    setPopped(new Set());
    later(700, () => setInflating(new Set()));
  };

  const rebuild = () => {
    const nav = menu.current;
    if (!nav) return;
    const rect = nav.getBoundingClientRect();
    const { feet } = backdropLayout(window.innerWidth, window.innerHeight);
    setGroundOffset(feet - rect.bottom + 4);
    // Either side of it, where they can be seen: the menu is in front of the village.
    callBuilders(rect.x + rect.width / 2, rect.width - 40, 4);
    later(BUILDERS_ARRIVE, () => setPhase('built'));
    for (let i = 0; i < count; i++) {
      later(FIRST_BALLOON + i * BALLOON_EVERY, () => {
        playHomeCue('inflate');
        setPopped((p) => new Set([...p].filter((n) => n !== i)));
        setInflating((s) => new Set([...s, i]));
      });
    }
    const allUp = FIRST_BALLOON + count * BALLOON_EVERY + 300;
    later(allUp, () => {
      setInflating(new Set());
      dismissBackdropBuilders();
      playHomeCue('lift-off');
      setPhase('rising');
    });
    later(allUp + RISE_MS, () => setPhase('up'));
  };

  const fall = () => {
    const nav = menu.current;
    if (!nav) return;
    const planks = [...nav.querySelectorAll<HTMLElement>('[data-plank]')];
    dropOnBackdrop(planks.map(snapshot));
    setPhase('fallen');
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      off();
      rebuild();
    };
    const off = onBackdrop((event) => {
      if (event.kind === 'cleared') go();
    });
    later(CLEAR_TIMEOUT_MS, go);
  };

  const pop = (i: number, pan: number) => {
    if (phase !== 'up' || popped.has(i)) return;
    playHomeCue('balloon-pop', pan);
    const next = new Set(popped).add(i);
    setPopped(next);
    clearTimeout(regrow.current);
    if (next.size < count) {
      regrow.current = setTimeout(() => blowUp(next), REGROW_MS);
    } else if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      regrow.current = setTimeout(() => blowUp(next), 1200);
    } else {
      // Let the last bang be seen before it all goes.
      later(180, fall);
    }
  };

  return { popped, inflating, phase, groundOffset, pop };
}
