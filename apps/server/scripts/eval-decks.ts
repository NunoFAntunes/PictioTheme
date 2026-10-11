/**
 * Model and prompt eval for AI deck generation (docs/technical/ai-deck-pipeline.md#evaluation).
 * Runs every model × prompt × theme through the real pipeline and saves each deck, its model
 * calls, automatic metrics and cost. Run by hand, never in CI:
 *
 *   pnpm --filter @pictiotheme/server deck:eval --models openai/gpt-6-luna --themes league,office
 *
 * Each deck's automatic quality numbers (scripts/eval/quality.ts) go in its record; the run's
 * totals are printed at the end, and `deck:quality <run folder>` prints them again.
 *
 * Spending is capped: a job only starts if the key's total usage (at start, plus this run's spend
 * and in-flight worst cases) stays under --cap USD. The key's real usage is checked at the end.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { DeckGenerationRequest, type GeneratedDeck } from '@pictiotheme/protocol';
import { z } from 'zod';
import { loadConfig } from '../src/config';
import type { Logger } from '../src/lib/logger';
import {
  CHAOS_MAX_TOKENS,
  createGenerationService,
  createOpenRouterClient,
  DECK_MAX_TOKENS,
  TOP_UP_MAX_TOKENS,
  type LlmClient,
  type LlmCompletion,
} from '../src/modules/generation';
import { CHAOS_PROMPTS, PROMPTS } from './eval/prompts';
import { acrossDecks, deckQuality, type QualityDeck } from './eval/quality';

const EVALS_DIR = new URL('../evals/', import.meta.url).pathname;

const { values } = parseArgs({
  options: {
    models: { type: 'string', default: 'all' },
    prompts: { type: 'string', default: 'current' },
    'chaos-prompt': { type: 'string', default: 'current' },
    themes: { type: 'string', default: 'all' },
    cap: { type: 'string', default: '0.90' },
    concurrency: { type: 'string', default: '6' },
    run: { type: 'string', default: new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') },
  },
});

const Theme = z.object({ id: z.string(), why: z.string(), request: DeckGenerationRequest });
const Model = z.object({ id: z.string(), requireParameters: z.boolean() });
const themesAll = z
  .array(Theme)
  .parse(JSON.parse(await readFile(join(EVALS_DIR, 'themes.json'), 'utf8')));
const modelsAll = z
  .array(Model)
  .parse(JSON.parse(await readFile(join(EVALS_DIR, 'models.json'), 'utf8')));

const pick = <T extends { id: string }>(all: T[], list: string) =>
  list === 'all'
    ? all
    : list.split(',').map((id) => all.find((x) => x.id === id) ?? fail(`unknown: ${id}`));
const fail = (msg: string): never => {
  throw new Error(msg);
};
const themes = pick(themesAll, values.themes);
const models = pick(modelsAll, values.models);
const prompts = values.prompts
  .split(',')
  .map((p) => (PROMPTS[p] ? p : fail(`unknown prompt: ${p}`)));
const chaosPrompt = CHAOS_PROMPTS[values['chaos-prompt']] ?? fail('unknown chaos prompt');
const cap = Number(values.cap);
const out = join(EVALS_DIR, 'results', values.run);

const config = loadConfig();
const apiKey = config.openRouter.apiKey ?? fail('OPENROUTER_API_KEY is not set');
const headers = { authorization: `Bearer ${apiKey}` };
const say = (line: string) => process.stderr.write(`${line}\n`);

async function keyUsage(): Promise<number> {
  const res = await fetch('https://openrouter.ai/api/v1/key', { headers });
  const body = z.object({ data: z.object({ usage: z.number() }) }).parse(await res.json());
  return body.data.usage;
}

/** USD per token, for worst-case budget reservations. */
async function prices(): Promise<Map<string, { input: number; output: number }>> {
  const res = await fetch('https://openrouter.ai/api/v1/models', { headers });
  const body = z
    .object({
      data: z.array(
        z.object({
          id: z.string(),
          pricing: z.object({ prompt: z.string(), completion: z.string() }),
        }),
      ),
    })
    .parse(await res.json());
  return new Map(
    body.data.map((m) => [
      m.id,
      { input: Number(m.pricing.prompt), output: Number(m.pricing.completion) },
    ]),
  );
}

const silentLog: Logger = { debug() {}, info() {}, warn() {}, error() {}, child: () => silentLog };

type Call = {
  ms: number;
  finishReason: string | null;
  model: string;
  provider: string | null;
  usage: LlmCompletion['usage'];
  content: string | null;
  error?: string;
};

/**
 * Records every model call, so cost and raw output are kept even when generation fails.
 * A failed call reports no cost but may still be billed (a timed-out call is), so it is
 * counted at its worst case: the full output budget.
 */
function recording(
  llm: LlmClient,
  calls: Call[],
  price: { input: number; output: number },
): LlmClient {
  return {
    async completeJson(request) {
      const start = Date.now();
      try {
        const c = await llm.completeJson(request);
        calls.push({
          ms: Date.now() - start,
          finishReason: c.finishReason,
          model: c.model,
          provider: c.provider,
          usage: c.usage,
          content: c.content,
        });
        return c;
      } catch (err) {
        calls.push({
          ms: Date.now() - start,
          finishReason: null,
          model: '',
          provider: null,
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            costUsd: request.maxTokens * price.output + 8000 * price.input,
          },
          content: null,
          error: String(err),
        });
        throw err;
      }
    },
  };
}

// ── Budget ──
const priceList = await prices();
const startUsage = await keyUsage();
let spent = 0;
let reserved = 0;
const worstCase = (modelId: string) => {
  const p = priceList.get(modelId) ?? fail(`no price for ${modelId}`);
  // Deck call, one retry, one top-up, then the same for the Chaos cards; ~8k input tokens each
  // (system prompt + card lists).
  return (
    (2 * DECK_MAX_TOKENS + 2 * CHAOS_MAX_TOKENS + 2 * TOP_UP_MAX_TOKENS) * p.output +
    6 * 8000 * p.input
  );
};
say(`key usage at start: $${startUsage.toFixed(4)}; cap $${cap}`);

// ── Jobs ──
type Job = { model: z.infer<typeof Model>; prompt: string; theme: z.infer<typeof Theme> };
const jobs: Job[] = models.flatMap((model) =>
  prompts.flatMap((prompt) => themes.map((theme) => ({ model, prompt, theme }))),
);
const summary: Array<Record<string, unknown>> = [];
const made: QualityDeck[] = [];
const perModelRunning = new Map<string, number>();
const MAX_PER_MODEL = 2;

async function runJob(job: Job) {
  const calls: Call[] = [];
  const llm = createOpenRouterClient({
    apiKey,
    model: job.model.id,
    fallbackModels: [],
    requireParameters: job.model.requireParameters,
    appUrl: config.publicOrigin,
  });
  const generation = createGenerationService({
    llm: recording(llm, calls, priceList.get(job.model.id) ?? fail(`no price for ${job.model.id}`)),
    log: silentLog,
    systemPrompt: PROMPTS[job.prompt],
    chaosPrompt,
  });
  const start = Date.now();
  let deck: GeneratedDeck | null = null;
  let error: string | null = null;
  let toppedUp = false;
  let dropped = {};
  try {
    const result = await generation.generateDeck(job.theme.request);
    deck = result.deck;
    toppedUp = result.toppedUp;
    dropped = result.dropped;
  } catch (err) {
    error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }
  const cost = calls.reduce((n, c) => n + (c.usage.costUsd ?? 0), 0);
  const record = {
    model: job.model.id,
    prompt: job.prompt,
    theme: job.theme.id,
    ok: deck !== null,
    error,
    ms: Date.now() - start,
    calls: calls.length,
    toppedUp,
    finishReasons: calls.map((c) => c.finishReason ?? c.error ?? null),
    providers: [...new Set(calls.map((c) => c.provider))],
    inputTokens: calls.reduce((n, c) => n + c.usage.inputTokens, 0),
    outputTokens: calls.reduce((n, c) => n + c.usage.outputTokens, 0),
    costUsd: +cost.toFixed(6),
    dropped,
    metrics: deck ? deckQuality({ ...deck, language: job.theme.request.language }) : null,
  };
  const file = join(out, job.prompt, job.model.id.replace(/[/:]/g, '_'), `${job.theme.id}.json`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ ...record, deck, rawCalls: calls }, null, 2));
  summary.push(record);
  if (deck)
    made.push({
      ...deck,
      title: `${job.theme.id} ${job.model.id}`,
      language: job.theme.request.language,
    });
  return { cost, record };
}

const queue = [...jobs];
let skipped = 0;
async function worker() {
  for (;;) {
    const index = queue.findIndex((j) => (perModelRunning.get(j.model.id) ?? 0) < MAX_PER_MODEL);
    if (queue.length === 0) return;
    if (index === -1) {
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }
    const [job] = queue.splice(index, 1);
    if (!job) continue;
    const worst = worstCase(job.model.id);
    if (startUsage + spent + reserved + worst > cap) {
      skipped++;
      say(
        `SKIP (budget) ${job.model.id} ${job.prompt} ${job.theme.id}: worst case $${worst.toFixed(4)}`,
      );
      continue;
    }
    reserved += worst;
    perModelRunning.set(job.model.id, (perModelRunning.get(job.model.id) ?? 0) + 1);
    try {
      const { cost, record } = await runJob(job);
      spent += cost;
      say(
        `${record.ok ? 'ok  ' : 'FAIL'} ${job.model.id.padEnd(38)} ${job.prompt.padEnd(12)} ${job.theme.id.padEnd(17)} ` +
          `${(record.ms / 1000).toFixed(0).padStart(4)}s $${record.costUsd.toFixed(4)} ${record.error ?? ''} | spent $${spent.toFixed(4)}`,
      );
    } finally {
      reserved -= worst;
      perModelRunning.set(job.model.id, (perModelRunning.get(job.model.id) ?? 1) - 1);
    }
  }
}

say(`${jobs.length} jobs → ${out}`);
await Promise.all(Array.from({ length: Number(values.concurrency) }, () => worker()));

await mkdir(out, { recursive: true });
await writeFile(join(out, 'summary.json'), JSON.stringify(summary, null, 2));
const { perDeck: _, ...quality } = acrossDecks(made);
say(`quality (deck:quality ${out} --per-deck for each deck):\n${JSON.stringify(quality, null, 2)}`);
const endUsage = await keyUsage();
say(
  `done: ${summary.length} runs, ${skipped} skipped. Counted cost $${spent.toFixed(4)} (failed calls at worst case); key usage $${startUsage.toFixed(4)} → $${endUsage.toFixed(4)} (Δ $${(endUsage - startUsage).toFixed(4)})`,
);
