/**
 * What every game checks before players see each other's words: names, chat, guesses and
 * generated decks (docs/technical/security-and-moderation.md). Pure, no game rules, so the
 * server, each game's core and the browser share it.
 */
export { hasProfanity, maskProfanity } from './profanity';
