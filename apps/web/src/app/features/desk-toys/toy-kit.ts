import type { SoundId } from '../sound';

/*
 * What every toy is built from. Toys are drawn like the logo's pencil (ink outlines, flat colour, a
 * soft shadow), react to a press with a one-off Web Animation, and are decorative: `aria-hidden`
 * wrappers, no state anyone else sees.
 */

export const INK = 'var(--color-ink)';
export const SHADOW = 'drop-shadow-[0_6px_5px_rgb(0_0_0/0.2)]';
export const TOY = 'pointer-events-auto cursor-pointer';
export const POP = 'cubic-bezier(0.34, 1.6, 0.64, 1)';

export type ViewBox = [number, number, number, number];

/**
 * Where a toy lies: `className` positions its anchor point (the mug's centre, the brush's tip)
 * against the nearest positioned box, `unit` is em per viewBox unit (so a box scales the toys in it
 * with its font size), and it's turned `rotate` degrees around that point. `transitionName` lets
 * the home page's toys slide off the desk when a room opens (global.css).
 */
export type Placement = {
  className: string;
  unit: number;
  rotate: number;
  transitionName?: string;
};

export function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Plays a one-off animation; with reduced motion the change just happens. */
export function play(
  el: Element | null,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): Animation | undefined {
  if (el && !reducedMotion()) return el.animate(keyframes, options);
  return undefined;
}

/**
 * The sound engine is loaded by the lobby and the room; importing it lazily keeps it out of the
 * home page's server render.
 */
export function sound(id: SoundId, rate: number, volume: number) {
  void import('../sound').then((m) => m.playSound(id, { rate, volume }));
}

export function between(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

let lastId = 0;

/** A key for something a toy leaves behind (a crumb, a drop, a stamp). */
export function nextId(): number {
  return ++lastId;
}
