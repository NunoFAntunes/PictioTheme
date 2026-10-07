import { z } from 'zod';

/**
 * The languages a room can play in, and so the languages decks are generated and translated into
 * (docs/product/decks.md#languages). Only languages the deck model writes well and whose script
 * the game handles: guess matching, hints and the word mask work per letter and split words on
 * spaces, so right-to-left scripts (Arabic, Hebrew) and scripts built from combining marks
 * (Hindi, Bengali, Thai) are left out until they're tested.
 *
 * `flag` is an ISO 3166-1 country code for the flag shown beside the language. `prompt` names the
 * language for the model, region included: the same deck differs between Portugal and Brazil.
 * `script` is what every card must be written in (checked after generation, clean-deck.ts).
 */
export const DECK_LANGUAGES = [
  {
    code: 'en',
    name: 'English',
    native: 'English',
    flag: 'GB',
    script: 'latin',
    prompt: 'English',
  },
  {
    code: 'es',
    name: 'Spanish (Spain)',
    native: 'Español (España)',
    flag: 'ES',
    script: 'latin',
    prompt: 'Spanish as spoken in Spain (Castilian)',
  },
  {
    code: 'es-419',
    name: 'Spanish (Latin America)',
    native: 'Español (Latinoamérica)',
    flag: 'MX',
    script: 'latin',
    prompt: 'neutral Latin American Spanish',
  },
  {
    code: 'pt-PT',
    name: 'Portuguese (Portugal)',
    native: 'Português (Portugal)',
    flag: 'PT',
    script: 'latin',
    prompt: 'European Portuguese as spoken in Portugal (not Brazilian Portuguese)',
  },
  {
    code: 'pt-BR',
    name: 'Portuguese (Brazil)',
    native: 'Português (Brasil)',
    flag: 'BR',
    script: 'latin',
    prompt: 'Brazilian Portuguese',
  },
  {
    code: 'fr',
    name: 'French',
    native: 'Français',
    flag: 'FR',
    script: 'latin',
    prompt: 'French as spoken in France',
  },
  {
    code: 'de',
    name: 'German',
    native: 'Deutsch',
    flag: 'DE',
    script: 'latin',
    prompt: 'German as spoken in Germany',
  },
  {
    code: 'it',
    name: 'Italian',
    native: 'Italiano',
    flag: 'IT',
    script: 'latin',
    prompt: 'Italian',
  },
  {
    code: 'nl',
    name: 'Dutch',
    native: 'Nederlands',
    flag: 'NL',
    script: 'latin',
    prompt: 'Dutch as spoken in the Netherlands',
  },
  { code: 'pl', name: 'Polish', native: 'Polski', flag: 'PL', script: 'latin', prompt: 'Polish' },
  {
    code: 'sv',
    name: 'Swedish',
    native: 'Svenska',
    flag: 'SE',
    script: 'latin',
    prompt: 'Swedish',
  },
  { code: 'da', name: 'Danish', native: 'Dansk', flag: 'DK', script: 'latin', prompt: 'Danish' },
  {
    code: 'nb',
    name: 'Norwegian',
    native: 'Norsk (bokmål)',
    flag: 'NO',
    script: 'latin',
    prompt: 'Norwegian Bokmål',
  },
  { code: 'fi', name: 'Finnish', native: 'Suomi', flag: 'FI', script: 'latin', prompt: 'Finnish' },
  { code: 'cs', name: 'Czech', native: 'Čeština', flag: 'CZ', script: 'latin', prompt: 'Czech' },
  {
    code: 'ro',
    name: 'Romanian',
    native: 'Română',
    flag: 'RO',
    script: 'latin',
    prompt: 'Romanian',
  },
  {
    code: 'hu',
    name: 'Hungarian',
    native: 'Magyar',
    flag: 'HU',
    script: 'latin',
    prompt: 'Hungarian',
  },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', flag: 'TR', script: 'latin', prompt: 'Turkish' },
  {
    code: 'id',
    name: 'Indonesian',
    native: 'Bahasa Indonesia',
    flag: 'ID',
    script: 'latin',
    prompt: 'Indonesian',
  },
  {
    code: 'vi',
    name: 'Vietnamese',
    native: 'Tiếng Việt',
    flag: 'VN',
    script: 'latin',
    prompt: 'Vietnamese',
  },
  { code: 'el', name: 'Greek', native: 'Ελληνικά', flag: 'GR', script: 'greek', prompt: 'Greek' },
  {
    code: 'uk',
    name: 'Ukrainian',
    native: 'Українська',
    flag: 'UA',
    script: 'cyrillic',
    prompt: 'Ukrainian',
  },
  {
    code: 'ru',
    name: 'Russian',
    native: 'Русский',
    flag: 'RU',
    script: 'cyrillic',
    prompt: 'Russian',
  },
  {
    code: 'ja',
    name: 'Japanese',
    native: '日本語',
    flag: 'JP',
    script: 'japanese',
    prompt: 'Japanese (kana and kanji, the way a Japanese party game would write it)',
  },
  {
    code: 'ko',
    name: 'Korean',
    native: '한국어',
    flag: 'KR',
    script: 'korean',
    prompt: 'Korean (Hangul) as spoken in South Korea',
  },
  {
    code: 'zh-Hans',
    name: 'Chinese (Simplified)',
    native: '简体中文',
    flag: 'CN',
    script: 'han',
    prompt: 'Mandarin Chinese in Simplified characters, as used in mainland China',
  },
  {
    code: 'zh-Hant',
    name: 'Chinese (Traditional)',
    native: '繁體中文',
    flag: 'TW',
    script: 'han',
    prompt: 'Mandarin Chinese in Traditional characters, as used in Taiwan',
  },
] as const;

export type DeckLanguageInfo = (typeof DECK_LANGUAGES)[number];
export type DeckScript = DeckLanguageInfo['script'];

const CODES = DECK_LANGUAGES.map((l) => l.code) as [
  DeckLanguageInfo['code'],
  ...DeckLanguageInfo['code'][],
];
export const DeckLanguage = z.enum(CODES);
export type DeckLanguage = z.infer<typeof DeckLanguage>;

/** The curated decks, and every room until the host picks another language. */
export const DEFAULT_DECK_LANGUAGE: DeckLanguage = 'en';
