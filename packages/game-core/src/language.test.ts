import { DECK_LANGUAGES } from '@pictiotheme/protocol';
import { describe, expect, it } from 'vitest';
import { deckLanguageInfo, isInLanguageScript, searchLanguages } from './language';

describe('isInLanguageScript', () => {
  it.each([
    ['Kürbis', 'de', true],
    ['Pão de queijo', 'pt-PT', true],
    ['Тыква', 'de', false],
    ['Тыква', 'ru', true],
    ['Pumpkin', 'ru', false],
    ['かぼちゃ', 'ja', true],
    ['Tシャツ', 'ja', true],
    ['Pumpkin', 'ja', false],
    ['호박', 'ko', true],
    ['南瓜', 'zh-Hans', true],
    ['かぼちゃ', 'zh-Hans', false],
    ['Κολοκύθα', 'el', true],
    ['Bí ngô', 'vi', true],
  ] as const)('%s in %s → %s', (text, language, expected) => {
    expect(isInLanguageScript(text, language)).toBe(expected);
  });
});

describe('searchLanguages', () => {
  it('finds languages by English or native name, or code, ignoring accents', () => {
    expect(searchLanguages('deutsch').map((l) => l.code)).toEqual(['de']);
    expect(searchLanguages('portug').map((l) => l.code)).toEqual(['pt-PT', 'pt-BR']);
    expect(searchLanguages('espanol').map((l) => l.code)).toEqual(['es', 'es-419']);
    expect(searchLanguages('pt-br').map((l) => l.code)).toEqual(['pt-BR']);
    expect(searchLanguages('日本').map((l) => l.code)).toEqual(['ja']);
  });

  it('lists every language for an empty query', () => {
    expect(searchLanguages('  ')).toHaveLength(DECK_LANGUAGES.length);
  });
});

it('describes every language code', () => {
  for (const l of DECK_LANGUAGES) expect(deckLanguageInfo(l.code)).toBe(l);
});
