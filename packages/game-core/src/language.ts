import {
  DECK_LANGUAGES,
  type DeckLanguage,
  type DeckLanguageInfo,
  type DeckScript,
} from '@pictiotheme/protocol';

/** Room and deck languages (docs/product/decks.md#languages). */

const BY_CODE = new Map<string, DeckLanguageInfo>(DECK_LANGUAGES.map((l) => [l.code, l]));

export function deckLanguageInfo(code: DeckLanguage): DeckLanguageInfo {
  // Every DeckLanguage is in the list: the enum is built from it.
  return BY_CODE.get(code) ?? DECK_LANGUAGES[0];
}

/** Letters a card in each script must use. Kana and Hangul alone are enough for ja and ko. */
const SCRIPT_LETTERS: Record<DeckScript, RegExp> = {
  latin: /\p{Script=Latin}/u,
  greek: /\p{Script=Greek}/u,
  cyrillic: /\p{Script=Cyrillic}/u,
  japanese: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
  korean: /\p{Script=Hangul}/u,
  han: /\p{Script=Han}/u,
};

/**
 * Whether a card's text is written in the script of `language`. Latin-script languages allow
 * only Latin letters. Other scripts need at least one letter of their own and allow Latin ones
 * too ("Tシャツ", "DJ 고양이"), but no third script.
 */
export function isInLanguageScript(text: string, language: DeckLanguage): boolean {
  const { script } = deckLanguageInfo(language);
  const own = SCRIPT_LETTERS[script];
  let hasOwn = false;
  for (const ch of text) {
    if (!/\p{L}/u.test(ch)) continue;
    if (own.test(ch)) hasOwn = true;
    else if (script === 'latin' || !SCRIPT_LETTERS.latin.test(ch)) return false;
  }
  return hasOwn;
}

function fold(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/**
 * Languages matching what the host typed: by English or native name, or code, ignoring case and
 * accents ("portug", "deutsch", "pt-br", "espanol"). Names that start with it come first.
 */
export function searchLanguages(query: string): DeckLanguageInfo[] {
  const q = fold(query);
  if (q === '') return [...DECK_LANGUAGES];
  const scored = DECK_LANGUAGES.flatMap((l) => {
    const names = [l.name, l.native, l.code].map(fold);
    if (names.some((n) => n.startsWith(q))) return [{ l, score: 0 }];
    if (names.some((n) => n.includes(q))) return [{ l, score: 1 }];
    return [];
  });
  return scored.sort((a, b) => a.score - b.score).map((s) => s.l);
}
