/*
 * The emotes' pictures, drawn like `ui/ScribbleIcons`: wobbly ink strokes on a 64×64 grid that
 * overshoot their ends, over a crayon fill that's shifted a little off the outline. One set of path
 * data feeds both the wheel's icons (`Doodle`) and the sprites `EmoteStage` flies around
 * (`doodleSvg`). Ink is `currentColor`.
 */

type Fill = { d: string; color: string; shift?: [number, number] };
type Line = { d: string; width?: number; color?: string };
export type DoodleArt = { fills: Fill[]; lines: Line[] };

const SUN = 'var(--color-pop-sun)';
const PINK = 'var(--color-pop-pink)';
const TOMATO = 'var(--color-pop-tomato)';
const TEAL = 'var(--color-pop-teal)';
const PURPLE = 'var(--color-pop-purple)';
const GREEN = 'var(--color-solved)';

/** A face's wobbly outline, and the same circle for its fill. */
const FACE =
  'M32 7C46 6.5 57 17 56.5 31.5 56 46 46 57 31.5 56.5 17 56 7 45.5 7.5 31 8 17 18 7.5 33.5 8';
const FACE_FILL =
  'M32 9C45 9 55 18 54.5 32 54 45 45 54.5 32 54.5 18.5 54.5 9.5 45 10 31.5 10.5 18 19 9 32 9Z';
const HAND =
  'M21 60 17.5 45Q14 40 9 34.5Q7 30 11.5 29.5Q15 30 20.5 37L19 15Q19 10.5 22.5 10.5Q26 10.5 26.5 15L27.5 30 28 8.5Q28.5 4.5 31.5 4.5Q35 5 35 9L35.5 29 37 12Q37.5 8.5 40.5 8.5Q43.5 9 43.5 12.5L42.5 31 45 19Q46 16 48.5 16.5Q51.5 17.5 51 21L48.5 42Q47 50 43.5 53.5L43.5 60';
const ARM =
  'M6 41C9 25 30 21 37 34L38 20Q30 18 31 11Q34 3 44 4Q54 5 54 14Q54 20 50.5 22L52 38Q58 50 51 57L8 58.5Q4 53 6 41';
const HEART =
  'M31 18.5C24 9 11 11 9.5 22 8 35 19 44 32 55.5 45 45 56 36 55 22 54 11 39 8.5 31.5 19.5 30 22';
const STAR = 'M31 4.5 39 23 57.5 24 43 36.5 48.5 56 32 45 15.5 56 21 36.5 6.5 24 25 23 32 5.5';

export const DOODLES = {
  dance: {
    fills: [
      {
        d: 'M30 6C35 6 38 9 38 13 38 17 35 20 31 20 27 20 24 17 24 13 24 9 26 6 30 6Z',
        color: PINK,
        shift: [1.5, 1],
      },
    ],
    lines: [
      {
        d: 'M30.5 4.5C35.5 4.5 38.5 8 38.5 12.5 38.5 17.5 35 20.5 30.5 20.5 26 20.5 23 17 23.5 12 24 8 27 5 32 5',
      },
      { d: 'M31 21 33 39.5' },
      { d: 'M17 13.5 32 26.5 46.5 15.5 49 9' },
      { d: 'M33 39.5 22.5 49.5 27.5 59' },
      { d: 'M33 39.5 45 47.5 54.5 42' },
      { d: 'M53 30.5 55 21Q59 23 60 26.5', width: 3.5 },
      { d: 'M48.5 31.5C50 29 54 29 53.5 31.5 53 34 49 34.5 48.5 32', width: 3.5 },
    ],
  },
  taunt: {
    fills: [
      { d: FACE_FILL, color: SUN, shift: [1.5, 1.5] },
      { d: 'M30 42Q30 54 37 53Q43 52 41 41Z', color: PINK },
    ],
    lines: [
      { d: FACE },
      { d: 'M18.5 23.5 26.5 27.5 18.5 31.5' },
      { d: 'M41 22.5Q42.5 27 40.5 31' },
      { d: 'M16.5 37.5Q32 46.5 47.5 36.5' },
      { d: 'M29.5 42Q29 55 37 54Q44 53 41.5 40.5' },
      { d: 'M35.5 44.5 36 49', width: 3 },
    ],
  },
  flex: {
    fills: [{ d: ARM, color: SUN, shift: [1.5, 1.5] }],
    lines: [
      { d: ARM },
      { d: 'M17 42Q27 47 37.5 39', width: 3.5 },
      { d: 'M38.5 13Q43 15.5 48 12.5', width: 3 },
    ],
  },
  cry: {
    fills: [
      { d: FACE_FILL, color: SUN, shift: [1.5, 1.5] },
      { d: 'M22 47Q32 36 42 47Q32 43 22 47Z', color: 'currentColor' },
    ],
    lines: [
      { d: FACE },
      { d: 'M16.5 24Q21.5 29.5 27 24' },
      { d: 'M37 24Q42.5 29.5 47.5 24' },
      { d: 'M21.5 47.5Q32 35.5 42.5 47.5Q32 43 21 47.5' },
      { d: 'M20.5 30Q16 40 21 50', width: 5, color: TEAL },
      { d: 'M44 30Q48.5 40 43.5 50', width: 5, color: TEAL },
    ],
  },
  squish: {
    fills: [
      {
        d: 'M6 50C6 43 20 41 32 41 46 41 58 43 58 50 58 56 46 58 32 58 18 58 6 57 6 50Z',
        color: SUN,
        shift: [1.5, 1],
      },
    ],
    lines: [
      {
        d: 'M31 40.5C18 40.5 4.5 42.5 5 50 5.5 57 18 59 32 59 46 59 59 57 59 50 59 43 46 40 29 40.5',
      },
      { d: 'M20 46 25 51.5M25.5 46 19.5 51.5', width: 3.5 },
      { d: 'M39 46 44 51.5M44.5 46 38.5 51.5', width: 3.5 },
      { d: 'M32 5 32.5 30.5M22.5 21.5 32.5 32 42.5 21', width: 5 },
      { d: 'M13 12 15.5 25.5M51.5 12 49 25.5', width: 3 },
    ],
  },
  hand: {
    fills: [{ d: `${HAND}Z`, color: SUN, shift: [1.5, 1] }],
    lines: [{ d: HAND }, { d: 'M25 45Q31 48.5 38.5 44', width: 3 }],
  },
  tomato: {
    fills: [
      {
        d: 'M32 19C46 18 55 27 54.5 39 54 50 44 57.5 31.5 57 19 56.5 10 49 10.5 37.5 11 26 20 19.5 32 19Z',
        color: TOMATO,
        shift: [1, 1],
      },
      { d: 'M32 21 24 15 30 16 32 9 35 16 42 14 37 21Z', color: GREEN },
    ],
    lines: [
      {
        d: 'M30 18C17 18.5 8 27 8.5 38 9 50 19 58.5 32 58.5 45 58.5 56 50 56 38 56 26 46 17.5 33 18',
      },
      { d: 'M32 21.5 23 14.5 30.5 15 32 7.5 35 15 43 13 37.5 21.5' },
      { d: 'M18.5 35Q19.5 28.5 25 26', width: 3.5 },
    ],
  },
  hug: {
    fills: [
      {
        d: 'M32 50C23 43 16 37 17 28 18 21 26 19 32 26 37 18 46 20 47 27 48 37 41 43 32 50Z',
        color: PINK,
        shift: [1, 1],
      },
    ],
    lines: [
      {
        d: 'M31.5 25C26 18 17 20 16 27.5 15 37 23 43.5 32 51 41 43.5 49 37 48 27.5 47 19.5 37 18 32 26',
      },
      { d: 'M7 25Q4 47 22 55.5 27 57.5 29 53' },
      { d: 'M57 25Q60 47 42 55.5 37 57.5 35 53' },
    ],
  },
  note: {
    fills: [{ d: 'M14 46C14 40 22 38 28 40 32 42 31 50 24 52 18 54 14 51 14 46Z', color: PURPLE }],
    lines: [
      { d: 'M13 45C13 39 22 36.5 28.5 39 33 41 32 51 24.5 53 17.5 55 12.5 51 13.5 44.5' },
      { d: 'M30.5 43 31 9.5Q40 12 46.5 20.5' },
    ],
  },
  notes: {
    fills: [
      { d: 'M8 49C8 44 14 42 19 44 22 46 21 52 16 53 11 54 8 52 8 49Z', color: TEAL },
      { d: 'M35 43C35 38 41 36 46 38 49 40 48 46 43 47 38 48 35 46 35 43Z', color: TEAL },
    ],
    lines: [
      { d: 'M7 48.5C7 43.5 14 41 19.5 43 23 45 22 53 15.5 54 10 55 6.5 52 7.5 47.5' },
      { d: 'M34 42.5C34 37.5 41 35 46.5 37 50 39 49 47 42.5 48 37 49 33.5 46 34.5 41.5' },
      { d: 'M21.5 46 22.5 14 49.5 7 48.5 40' },
      { d: 'M22.5 22.5 49 15.5', width: 4 },
    ],
  },
  heart: {
    fills: [{ d: `${HEART}Z`, color: PINK, shift: [1.5, 1] }],
    lines: [{ d: HEART }, { d: 'M17 24Q18 19 22 18', width: 3 }],
  },
  tear: {
    fills: [
      {
        d: 'M32 8C38 20 48 30 47 41 46 51 39 56 31 55.5 23 55 17 49 17.5 41 18 30 27 20 32 8Z',
        color: TEAL,
        shift: [1, 1],
      },
    ],
    lines: [
      {
        d: 'M32.5 6C27 19 17 30 16.5 40.5 16 50 23 57 32 57 41 57 48 50 48 40.5 48 30 38 19 31.5 7.5',
      },
      { d: 'M24.5 41Q24.5 47.5 30 50', width: 3 },
    ],
  },
  star: {
    fills: [{ d: `${STAR}Z`, color: SUN, shift: [1.5, 1.5] }],
    lines: [{ d: STAR }],
  },
} as const satisfies Record<string, DoodleArt>;

export type DoodleName = keyof typeof DOODLES;

/** The doodle as SVG markup, for the sprites the stage creates outside React. */
export function doodleSvg(name: DoodleName): string {
  const art: DoodleArt = DOODLES[name];
  const fills = art.fills.map(
    (f) =>
      `<path d="${f.d}" fill="${f.color}"${f.shift ? ` transform="translate(${f.shift.join(' ')})"` : ''}/>`,
  );
  const lines = art.lines.map(
    (l) =>
      `<path d="${l.d}" fill="none" stroke="${l.color ?? 'currentColor'}" stroke-width="${l.width ?? 4.5}" stroke-linecap="round" stroke-linejoin="round"/>`,
  );
  return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">${[...fills, ...lines].join('')}</svg>`;
}
