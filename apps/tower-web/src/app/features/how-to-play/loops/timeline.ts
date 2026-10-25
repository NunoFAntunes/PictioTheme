/**
 * Timing for the guide's looping pictures: every loop is a pure function of the time since it
 * started (ms), built from these. No state between frames, so any moment can be drawn on its own
 * (the still frame shown with reduced motion is just one of them).
 */

export const clamp01 = (k: number) => Math.min(1, Math.max(0, k));

/** 0 before `from`, 1 after `to`, and how far along in between. */
export const span = (t: number, from: number, to: number) => clamp01((t - from) / (to - from));

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export const easeIn = (k: number) => k * k * k;
export const easeOut = (k: number) => 1 - (1 - k) ** 3;
export const easeInOut = (k: number) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
/** Overshoots a little, then settles: things popping into view. */
export const easeOutBack = (k: number) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;

/**
 * A damped shake after `at`: `amp` at first, dying out over `ms`, `hz` times a second. 0 before
 * `at` and after `ms`. For a landing's squash, a wobble, a "wrong!" shake.
 */
export function ring(t: number, at: number, ms: number, amp: number, hz = 6): number {
  if (t < at || t > at + ms) return 0;
  const k = (t - at) / ms;
  return amp * (1 - k) ** 2 * Math.sin(k * (ms / 1000) * hz * Math.PI * 2);
}

/** The first characters of `text`, typed one every `perChar` ms from `from`. */
export function typed(text: string, from: number, perChar: number, t: number): string {
  if (t < from) return '';
  return text.slice(0, Math.floor((t - from) / perChar) + 1);
}

/** 0–1: the fade to the sky at the end of a loop, so it starts over without a jump. */
export const fadeOut = (t: number, duration: number, ms = 400) => span(t, duration - ms, duration);
