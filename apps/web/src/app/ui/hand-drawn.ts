/*
 * Shapes that look drawn with a marker rather than a ruler: lopsided corners (elliptical radii
 * that disagree with each other, in em so they keep their shape at any size) and an outline that presses harder on its bottom and right. The
 * offset shadow follows the radii, so it wobbles too. Mix the shapes so no two things match.
 */

export const WOBBLE = [
  'rounded-[1.6em_0.6em_1.4em_0.8em/0.8em_1.2em_0.7em_1.2em]',
  'rounded-[0.7em_1.5em_0.9em_1.7em/1.1em_0.8em_1.2em_0.7em]',
  'rounded-[1.2em_0.8em_1.6em_0.6em/0.7em_1.1em_0.9em_1.2em]',
] as const;

/** A marker outline, heavier where the pen pressed. */
export const MARKER_BORDER = 'border-ink border-[3px_4px_4.5px_3px]';

/**
 * A home-page button: a lopsided sticker in the logo's font, tilted a little, that tips further
 * and lifts when you point at it. Add a `WOBBLE` shape, a tilt and a colour.
 */
export const DOODLE_BUTTON = `inline-flex items-center gap-2 font-logo font-normal ${MARKER_BORDER} shadow-[4px_5px_0_var(--color-ink)] transition hover:-translate-y-0.5 hover:rotate-0 hover:shadow-[6px_7px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-dashed focus-visible:outline-ink active:translate-y-0.5 active:shadow-[1px_1px_0_var(--color-ink)] disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none`;
