import type { PlayerId } from '@pictiotheme/protocol';
import { SPELL_TUNING, type TestAction } from '@pictiotheme/protocol/tower';
import { builderBot, isTestRoom } from './bots';
import { announceRound, decide, onCast, solveRound } from './match';
import { send, sendError, sendToAll } from './output';
import { onStarsTimer } from './stars';
import { otherTeam, type Ctx } from './types';

/**
 * Test mode's stand-ins for guessing (docs/tower/planning/test-mode.md): a button instead of the
 * word, and a rival bot that does what it's told. Everything after (deciding, curses, placing,
 * spells, stars) is the real match.
 */
export function onTest(c: Ctx, playerId: PlayerId, action: TestAction): void {
  const m = c.state.phase === 'playing' ? c.state.match : null;
  const team = c.state.players.get(playerId)?.team;
  if (!isTestRoom(c)) {
    sendError(c, playerId, 'FORBIDDEN', 'This is not a test room');
    return;
  }
  if (!m || !team) {
    sendError(c, playerId, 'WRONG_PHASE', 'Start the match first');
    return;
  }
  const rival = otherTeam(team);
  const rivalBot = builderBot(c, rival);

  switch (action.kind) {
    case 'solve': {
      if (m.crews[team].placing?.placerId === playerId) {
        sendError(c, playerId, 'WRONG_PHASE', 'Place your piece first');
        return;
      }
      if (action.target === 'steal' && !c.state.settings.steals) {
        sendError(c, playerId, 'WRONG_PHASE', 'Steals are off in this room');
        return;
      }
      const from = action.target === 'own' ? team : rival;
      const round = m.crews[from].round;
      if (!round) {
        sendError(c, playerId, 'WRONG_PHASE', 'There is no drawing right now');
        return;
      }
      // As if they'd typed the word: the same feedback (and sound) as a right guess.
      send(c, playerId, {
        t: 'guess:result',
        target: action.target,
        text: round.card.text,
        result: 'correct',
      });
      solveRound(c, from, playerId, round, action.target === 'steal', action.curse);
      return;
    }
    case 'rival': {
      if (!rivalBot) {
        sendError(c, playerId, 'WRONG_PHASE', 'The other crew has people in it, not a bot');
        return;
      }
      const from = action.target === 'own' ? rival : team;
      const round = m.crews[from].round;
      if (!round) {
        sendError(c, playerId, 'WRONG_PHASE', 'There is no drawing for them to guess');
        return;
      }
      const piece = solveRound(c, from, rivalBot, round, action.target === 'steal', action.curse);
      if (piece) decide(c, piece, action.choice);
      return;
    }
    case 'rival-cast':
      if (!rivalBot) {
        sendError(c, playerId, 'WRONG_PHASE', 'The other crew has people in it, not a bot');
        return;
      }
      onCast(c, rivalBot, action.slot);
      return;
    case 'grant': {
      const crew = m.crews[action.team];
      if (crew.charges.length >= SPELL_TUNING.maxCharges) {
        sendError(c, playerId, 'WRONG_PHASE', 'That crew already holds two spells');
        return;
      }
      crew.charges.push(action.spell);
      sendToAll(c, { t: 'crew:charges', team: action.team, charges: crew.charges });
      return;
    }
    case 'golden': {
      const crew = m.crews[action.team];
      if (!crew.round) {
        sendError(c, playerId, 'WRONG_PHASE', 'There is no drawing right now');
        return;
      }
      crew.round.golden = true;
      crew.lastGolden = true;
      announceRound(c, action.team, crew.round);
      return;
    }
    case 'stars':
      onStarsTimer(c);
      return;
  }
}
