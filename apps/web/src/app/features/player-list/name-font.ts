/**
 * Each player's name is written in one messy handwriting font, picked from their id and the room
 * code: random-looking, the same on every client, and possibly different in the next room.
 * The fonts are self-hosted (astro.config.mjs) and loaded by src/pages/app.astro.
 */

export type NameFont = {
  /** CSS font-family, with the variable Astro's <Font> sets. */
  family: string;
  /** Multiplies the name's font size: some hands run small, wide or tall. */
  scale: number;
};

const font = (cssVariable: string, scale: number): NameFont => ({
  family: `var(${cssVariable}), cursive`,
  scale,
});

const ROCK_SALT = font('--font-rock-salt', 0.78);

export const NAME_FONTS: readonly NameFont[] = [
  ROCK_SALT,
  font('--font-gloria-hallelujah', 0.95),
  font('--font-gochi-hand', 1.15),
  font('--font-schoolbell', 1.05),
  font('--font-kranky', 1),
  font('--font-sedgwick-ave', 1.1),
  font('--font-walter-turncoat', 0.95),
  font('--font-covered-by-your-grace', 1.25),
  font('--font-just-me-again-down-here', 1.3),
  font('--font-fuzzy-bubbles', 0.95),
];

/** A stable 32-bit hash of the strings (FNV-1a). Drives every per-player random-looking choice. */
export function playerHash(...parts: string[]): number {
  let hash = 0x811c9dc5;
  for (const ch of parts.join('|')) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function nameFont(playerId: string, roomCode: string): NameFont {
  return NAME_FONTS[playerHash(playerId, roomCode) % NAME_FONTS.length] ?? ROCK_SALT;
}
