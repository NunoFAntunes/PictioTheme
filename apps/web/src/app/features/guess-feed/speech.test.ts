import { describe, expect, it } from 'vitest';
import { sameWords, speechErrorMessage, speechLang } from './speech';

describe('speechLang', () => {
  it.each([
    ['en', 'en-GB'],
    ['es', 'es-ES'],
    ['es-419', 'es-MX'],
    ['pt-PT', 'pt-PT'],
    ['pt-BR', 'pt-BR'],
    ['nb', 'nb-NO'],
    ['el', 'el-GR'],
    ['zh-Hans', 'zh-CN'],
    ['zh-Hant', 'zh-TW'],
  ] as const)('%s → %s', (language, locale) => {
    expect(speechLang(language)).toBe(locale);
  });
});

describe('speechErrorMessage', () => {
  it('stays quiet when listening was cancelled', () => {
    expect(speechErrorMessage('aborted')).toBeNull();
  });

  it('explains a blocked microphone', () => {
    expect(speechErrorMessage('not-allowed')).toMatch(/blocked/);
  });
});

describe('sameWords', () => {
  it('ignores case and punctuation', () => {
    expect(sameWords('cactus', 'Cactus.')).toBe(true);
    expect(sameWords('big purple', ' big, purple! ')).toBe(true);
  });

  it('tells more words apart', () => {
    expect(sameWords('big purple', 'big purple cactus')).toBe(false);
  });
});
