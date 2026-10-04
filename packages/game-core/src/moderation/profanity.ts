import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from 'obscenity';

/**
 * Profanity and slur detection for anything players show each other: chat, guesses, names and
 * generated decks (docs/technical/security-and-moderation.md). Built on `obscenity`'s English
 * list, which already handles leetspeak ("sh1t"), spacing tricks and false positives like
 * "Scunthorpe" or "cocktail". Pure: no I/O.
 */

/** Real phrases that contain a listed word but are fine to draw or say. */
const ALLOWED_PHRASES = [
  'moby dick',
  'dick van dyke',
  'dick tracy',
  'spotted dick',
  'cockpit',
  'shiitake',
  'great tit',
  'blue tit',
  'pussy willow',
];

const built = englishDataset.build();
const matcher = new RegExpMatcher({
  ...built,
  ...englishRecommendedTransformers,
  whitelistedTerms: [...(built.whitelistedTerms ?? []), ...ALLOWED_PHRASES],
});

const WORD_CHAR = /[\p{L}\p{N}_]/u;

/** True if the text contains a listed word. */
export function hasProfanity(text: string): boolean {
  return matcher.hasMatch(text);
}

/**
 * Replaces every listed word with asterisks. The whole word is masked, not only the matched part
 * ("f4ggot" → "******"), so the length is all that's left.
 */
export function maskProfanity(text: string): string {
  const matches = matcher.getAllMatches(text);
  if (matches.length === 0) return text;
  const chars = [...text];
  // obscenity reports indices in UTF-16 code units; map them onto code points.
  const unitToPoint: number[] = [];
  chars.forEach((ch, i) => {
    for (let u = 0; u < ch.length; u++) unitToPoint.push(i);
  });
  for (const m of matches) {
    let start = unitToPoint[m.startIndex] ?? 0;
    let end = unitToPoint[m.endIndex] ?? chars.length - 1; // inclusive
    while (start > 0 && WORD_CHAR.test(chars[start - 1] ?? '')) start--;
    while (end < chars.length - 1 && WORD_CHAR.test(chars[end + 1] ?? '')) end++;
    for (let i = start; i <= end; i++) if (!/\s/.test(chars[i] ?? '')) chars[i] = '*';
  }
  return chars.join('');
}
