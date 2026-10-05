import { beforeAll, describe, expect, it } from 'vitest';
import { fitName, shareCardFonts, shareCardSvg, type ShareCardFonts } from './share-card';

let fonts: ShareCardFonts;
beforeAll(async () => {
  fonts = await shareCardFonts();
});

const input = {
  code: 'KMB-XRT',
  name: "Sneaky Pickle's room",
  host: 'doodlewhirl.example',
  deck: { title: 'Halloween Monsters', cover: null },
  rounds: 3,
  drawSeconds: 80,
  difficulties: ['easy', 'medium'] as const,
  silly: true,
};

describe('the share card', () => {
  it('measures text with the font', () => {
    expect(fonts.logo.measure('WWW', 100)).toBeGreaterThan(fonts.logo.measure('iii', 100));
    expect(fonts.hand.measure('ab', 50)).toBeCloseTo(fonts.hand.measure('ab', 100) / 2);
  });

  it('keeps a short name big on one line and splits a long one into two', () => {
    expect(fitName('Pickles', fonts.logo)).toMatchObject({ lines: ['Pickles'], size: 86 });
    const long = fitName('The Very Sneaky Pickle Gang', fonts.logo);
    expect(long.lines).toHaveLength(2);
    expect(long.lines.join(' ')).toBe('The Very Sneaky Pickle Gang');
  });

  it('shortens a name that cannot fit', () => {
    const { lines } = fitName('Supercalifragilisticexpialidocious!!', fonts.logo);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/…$/);
    expect(fonts.logo.measure(lines[0]!, 36, 36 * 0.03)).toBeLessThanOrEqual(420 * 1.03);
  });

  it('shows the code, the deck and the rules, with text escaped', () => {
    const svg = shareCardSvg({ ...input, name: 'Tom & <Jerry>' }, fonts);
    expect(svg).toContain('&amp;');
    expect(svg).not.toContain('<Jerry>');
    for (const text of ['KMB', 'XRT', 'Halloween Monsters', '3 rounds', '80s to draw']) {
      expect(svg).toContain(text);
    }
    expect(svg).toContain('Easy · Medium');
    expect(svg).toContain('Silly mode!');
  });

  it('draws the same card for the same room', () => {
    expect(shareCardSvg(input, fonts)).toBe(shareCardSvg(input, fonts));
  });
});
