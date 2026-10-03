import { ROOM_CODE_ALPHABET } from '@pictiotheme/protocol';
import { randomInt, type Rng } from './rng';

/**
 * Three-letter strings a room code must never contain. A starting list. Extend it as reports come in.
 * Checked as substrings of the 6 letters, so "XASSXX" is rejected too.
 */
const BLOCKED_TRIGRAMS = new Set([
  'ASS',
  'CUM',
  'DCK',
  'DIK',
  'FAG',
  'FCK',
  'FUC',
  'FUK',
  'FUX',
  'JIZ',
  'KKK',
  'NAZ',
  'NGR',
  'NIG',
  'PNS',
  'PUS',
  'RAP',
  'SEX',
  'SHT',
  'SLT',
  'TIT',
  'TWT',
  'VAG',
  'WTF',
  'XXX',
]);

export function isBlockedRoomCode(letters: string): boolean {
  for (let i = 0; i + 3 <= letters.length; i++) {
    if (BLOCKED_TRIGRAMS.has(letters.slice(i, i + 3))) return true;
  }
  return false;
}

function formatRoomCode(letters: string): string {
  return `${letters.slice(0, 3)}-${letters.slice(3)}`;
}

/**
 * A new code in `ABC-DEF` format that passes the blocklist.
 * Uniqueness is checked by the caller against the room registry.
 */
export function generateRoomCode(rng: Rng): string {
  for (;;) {
    let letters = '';
    for (let i = 0; i < 6; i++) {
      letters += ROOM_CODE_ALPHABET[randomInt(rng, ROOM_CODE_ALPHABET.length)];
    }
    if (!isBlockedRoomCode(letters)) return formatRoomCode(letters);
  }
}

export type NormalizedRoomCode =
  { ok: true; code: string } | { ok: false; reason: 'ambiguous_letters' | 'wrong_length' };

/**
 * Turns what a user typed ("abc def", "ABC-DEF", "abcdef") into `ABC-DEF`.
 * I, O, 0 and 1 never appear in codes, so they get a specific hint instead of "not found".
 */
export function normalizeRoomCode(input: string): NormalizedRoomCode {
  const upper = input.toUpperCase();
  if (/[IO01]/.test(upper)) return { ok: false, reason: 'ambiguous_letters' };
  const letters = upper.replace(/[^A-Z]/g, '');
  if (letters.length !== 6) return { ok: false, reason: 'wrong_length' };
  return { ok: true, code: formatRoomCode(letters) };
}
