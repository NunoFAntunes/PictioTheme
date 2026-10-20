import type { FontMetrics } from '../../lib/font-metrics';
import { beforeAll, describe, expect, it } from 'vitest';
import { towerShareCardFont, towerShareCardSvg, towerShareEmbedHtml } from './tower-share-card';

let font: FontMetrics;
beforeAll(async () => {
  font = await towerShareCardFont();
});

const input = {
  code: 'KMB-XRT',
  name: "Sneaky Pickle's tower",
  host: 'doodletower.example',
  line: 'medium' as const,
  roundSeconds: 60,
  steals: true,
};

describe("Doodle Tower's share card", () => {
  it('shows the name, the code, the rules and where to join, with text escaped', () => {
    const svg = towerShareCardSvg({ ...input, name: "Tom & <Jerry>'s tower" }, font);
    expect(svg).toContain('Tom &amp; &lt;Jerry&gt;&#39;s tower');
    expect(svg).not.toContain('<Jerry>');
    for (const text of [
      'KMB-XRT',
      'Line 10 m',
      '60s to draw',
      'Steals on',
      'doodletower.example',
    ]) {
      expect(svg).toContain(text);
    }
    expect(towerShareCardSvg({ ...input, steals: false }, font)).toContain('No steals');
  });

  it('shortens a name too long for the card', () => {
    const svg = towerShareCardSvg({ ...input, name: `${'Wobbly'.repeat(6)}'s tower` }, font);
    expect(svg).toMatch(/…<\/text>/);
  });

  it('draws the same card for the same room', () => {
    expect(towerShareCardSvg(input, font)).toBe(towerShareCardSvg(input, font));
  });

  it('gives link previews the card, the invite link and a description', () => {
    const html = towerShareEmbedHtml({
      origin: 'https://doodletower.example',
      code: 'KMB-XRT',
      name: input.name,
      line: 'tall',
      imageVersion: 'abc123',
    });
    expect(html).toContain(
      'content="https://doodletower.example/api/tower/rooms/KMB-XRT/card.png?v=abc123"',
    );
    expect(html).toContain('href="https://doodletower.example/r/KMB-XRT"');
    expect(html).toContain('Line at 15 m');
    expect(html).toContain('og:site_name" content="Doodle Tower"');
  });
});
