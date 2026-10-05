/**
 * Just enough of a TrueType font to measure a line of text: the advance width of each character
 * (`cmap` format 4 → glyph, `hmtx` → advance). The share card uses it to fit the room's name and
 * size its stickers; resvg does the actual drawing.
 */

export type FontMetrics = {
  /** The line's width at `size` px, with `letterSpacing` px between characters. */
  measure(text: string, size: number, letterSpacing?: number): number;
};

export function readFontMetrics(ttf: Buffer): FontMetrics {
  const tables = new Map<string, number>();
  const numTables = ttf.readUInt16BE(4);
  for (let i = 0; i < numTables; i++) {
    const at = 12 + i * 16;
    tables.set(ttf.toString('latin1', at, at + 4), ttf.readUInt32BE(at + 8));
  }
  const table = (tag: string): number => {
    const offset = tables.get(tag);
    if (offset === undefined) throw new Error(`Font has no ${tag} table`);
    return offset;
  };

  const unitsPerEm = ttf.readUInt16BE(table('head') + 18);
  const numberOfHMetrics = ttf.readUInt16BE(table('hhea') + 34);
  const hmtx = table('hmtx');
  const advanceOf = (glyph: number) =>
    ttf.readUInt16BE(hmtx + 4 * Math.min(glyph, numberOfHMetrics - 1));

  // The Windows Unicode BMP subtable (3, 1), format 4: segments of consecutive characters.
  const cmap = table('cmap');
  let format4 = -1;
  for (let i = 0; i < ttf.readUInt16BE(cmap + 2); i++) {
    const at = cmap + 4 + i * 8;
    const offset = cmap + ttf.readUInt32BE(at + 4);
    if (ttf.readUInt16BE(at) === 3 && ttf.readUInt16BE(at + 2) === 1) {
      if (ttf.readUInt16BE(offset) === 4) format4 = offset;
    }
  }
  if (format4 < 0) throw new Error('Font has no Unicode BMP cmap');
  const segments = ttf.readUInt16BE(format4 + 6) / 2;
  const ends = format4 + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const rangeOffsets = deltas + segments * 2;

  function glyphOf(code: number): number {
    for (let s = 0; s < segments; s++) {
      if (code > ttf.readUInt16BE(ends + s * 2)) continue;
      const start = ttf.readUInt16BE(starts + s * 2);
      if (code < start) return 0;
      const delta = ttf.readInt16BE(deltas + s * 2);
      const rangeAt = rangeOffsets + s * 2;
      const rangeOffset = ttf.readUInt16BE(rangeAt);
      if (rangeOffset === 0) return (code + delta) & 0xffff;
      const glyph = ttf.readUInt16BE(rangeAt + rangeOffset + (code - start) * 2);
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  }

  const cache = new Map<number, number>();
  function advance(code: number): number {
    let width = cache.get(code);
    if (width === undefined) {
      width = advanceOf(code > 0xffff ? 0 : glyphOf(code)) / unitsPerEm;
      cache.set(code, width);
    }
    return width;
  }

  return {
    measure(text, size, letterSpacing = 0) {
      const chars = [...text];
      let em = 0;
      for (const ch of chars) em += advance(ch.codePointAt(0) ?? 0);
      return em * size + letterSpacing * Math.max(0, chars.length - 1);
    },
  };
}
