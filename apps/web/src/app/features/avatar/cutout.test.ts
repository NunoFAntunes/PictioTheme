import { describe, expect, it } from 'vitest';
import { cutout, type Pixels } from './cutout';

/** A white image from rows of characters: '#' ink, '.' white, ' ' transparent. */
function image(rows: string[]): Pixels {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const data = new Uint8ClampedArray(width * height * 4);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const i = (y * width + x) * 4;
      const v = ch === '#' ? 20 : 255;
      data.set([v, v, v, ch === ' ' ? 0 : 255], i);
    }),
  );
  return { data, width, height };
}

const alpha = (img: Pixels, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3];

describe('cutout', () => {
  it('clears the white background but keeps white enclosed by lines', () => {
    const img = image([
      '.......', //
      '.#####.',
      '.#...#.',
      '.#####.',
      '.......',
    ]);
    const box = cutout(img);
    expect(alpha(img, 0, 0)).toBe(0);
    expect(alpha(img, 6, 4)).toBe(0);
    expect(alpha(img, 3, 2)).toBe(255); // the "eye"
    expect(alpha(img, 1, 1)).toBe(255);
    expect(box).toEqual({ x: 1, y: 1, width: 5, height: 3 });
  });

  it('pads the box without leaving the image', () => {
    const img = image([
      '#....', //
      '.....',
      '....#',
    ]);
    expect(cutout(img, 2)).toEqual({ x: 0, y: 0, width: 5, height: 3 });
  });

  it('handles an already transparent drawing', () => {
    const img = image([
      '     ', //
      '  #  ',
      '     ',
    ]);
    expect(cutout(img)).toEqual({ x: 2, y: 1, width: 1, height: 1 });
  });

  it('returns null for an empty image', () => {
    expect(cutout(image(['...', '...']))).toBeNull();
  });
});
