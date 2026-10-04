/**
 * Generates one deck with the real model and prints it as JSON. Run by hand, never in CI:
 *
 *   pnpm --filter @pictiotheme/server deck:generate --theme "pirates" --difficulties easy,medium --silly
 *
 * Needs OPENROUTER_API_KEY in apps/server/.env. The deck goes to stdout, the log to stderr.
 */
import { parseArgs } from 'node:util';
import { DeckGenerationRequest } from '@pictiotheme/protocol';
import { z } from 'zod';
import { loadConfig } from '../src/config';
import type { Logger } from '../src/lib/logger';
import { createGenerationService, createOpenRouterClient } from '../src/modules/generation';

const { values } = parseArgs({
  options: {
    theme: { type: 'string' },
    notes: { type: 'string', default: '' },
    difficulties: { type: 'string', default: 'easy,medium,hard' },
    silly: { type: 'boolean', default: false },
  },
});

const request = DeckGenerationRequest.safeParse({
  theme: values.theme,
  notes: values.notes,
  difficulties: values.difficulties.split(',').map((d) => d.trim()),
  silly: values.silly,
});
if (!request.success) {
  process.stderr.write(`${z.prettifyError(request.error)}\n`);
  process.exit(1);
}

function stderrLogger(bindings: Record<string, unknown> = {}): Logger {
  const write = (level: string) => (objOrMsg: object | string, msg?: string) => {
    const fields = typeof objOrMsg === 'string' ? {} : objOrMsg;
    const text = typeof objOrMsg === 'string' ? objOrMsg : (msg ?? '');
    process.stderr.write(`${level} ${text} ${JSON.stringify({ ...bindings, ...fields })}\n`);
  };
  return {
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
    child: (more) => stderrLogger({ ...bindings, ...more }),
  };
}

const config = loadConfig();
const { apiKey, deckModel, fallbackModels, requireParameters } = config.openRouter;
const generation = createGenerationService({
  llm: apiKey
    ? createOpenRouterClient({
        apiKey,
        model: deckModel,
        fallbackModels,
        requireParameters,
        appUrl: config.publicOrigin,
      })
    : null,
  log: stderrLogger(),
});

const result = await generation.generateDeck(request.data);
process.stdout.write(`${JSON.stringify(result.deck, null, 2)}\n`);
