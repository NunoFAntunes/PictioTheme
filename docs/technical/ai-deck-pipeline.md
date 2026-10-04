# AI Deck Generation Pipeline

## Goals

- Produce a **good, drawable, themed** deck in one request: easy, medium, and hard cards plus a silly pool.
- Return **machine-valid JSON** every time.
- Keep content **family-friendly by default** and refuse abusive themes.
- Cost per deck should be known and logged.

## Flow

```
User submits theme ─► API: auth check, rate limit, theme pre-check, reserve credit, enqueue job
                           │
                     Worker picks job
                           │
            1. Build prompt (theme, notes, language, flags)
            2. Call the model via OpenRouter (streaming, JSON schema) ──► progress events via SSE
            3. Validate & clean (schema, dedupe, length, blocklist, cross-deck duplicates)
            4. If too few cards survive → one targeted "top-up" call
            5. Save deck as draft (status = review)
                           │
       User reviews (removes cards / one free regenerate) ─► Publish ─► commit credit
                           │
                      Any failure ─► refund credit, status = failed
```

### What's built (2026-10)

The pipeline steps above run in `generation.service.ts`. Around them, `generation-jobs.service.ts` runs each generation **in-process** as a row in `generation_jobs`: `POST /api/decks/generations` inserts the job and starts it without waiting, the client polls `GET /api/decks/generations/:id`, and the finished deck is saved through the decks service (`decks`/`cards` tables) with no review step. A restart fails any running job at boot. While a job runs (or after it's published), its creator can attach the drawn [back cover](../product/decks.md#back-cover) with `PUT /api/decks/generations/:id/cover`; the job holds it and it's copied onto the deck whichever of the two finishes last. Later, `PUT /api/decks/:id/cover` redraws it: the published job with that `deck_id` and the caller as `created_by` is the ownership check. Generation is on for everyone, guests included, within daily limits checked before a job starts: 1 deck per player and 3 per IP in any 24 hours (failed jobs don't count), and a global daily budget (running jobs count at an estimated $0.02). `DECK_GENERATION=off` is the kill switch, and the feature reports itself off when there's no API key. The theme pre-check (blocklist on theme and notes) runs before the job is created, and the blocklist runs again on the cards, alternates, title and tags (`content-check.ts`). Still to come from the flow above: auth and credits, pg-boss, streaming progress, the review step, and the optional LLM theme check.

## Model access: OpenRouter

Models are called through **OpenRouter** so several can be compared with one API and one key ([decisions.md](decisions.md#d4--openrouter-for-model-inference)). Production uses **one model chosen by the [eval](#evaluation)**: `openai/gpt-6-luna` with `openai/gpt-6-luna-pro` as the fallback, ~$0.004 per deck ([model-eval-2026-10.md](model-eval-2026-10.md), [decisions.md](decisions.md) D6).

### Client

- The `generation` module defines an `LlmClient` interface (`completeJson({ system, user, schema, maxTokens }) → { content, finishReason, refusal, model, provider, usage }`, in `generation/llm/llm-client.ts`). It's generic rather than deck-specific so the top-up call and the theme classifier can use it too. The only production implementation is `createOpenRouterClient`, which calls `https://openrouter.ai/api/v1/chat/completions` with plain `fetch` and validates the reply with zod. No SDK: OpenRouter's extra fields (`models`, `provider`, `reasoning`) aren't in the `openai` SDK's types anyway. Tests use a fake client (`test-support/llm.ts`, [backend-guidelines.md](backend-guidelines.md#testing)).
- Not built yet: streaming and progress events. Calls are non-streaming for now.
- Models come from **config, not code**: `DECK_MODEL` (primary) and `DECK_FALLBACK_MODELS` (comma-separated). `DECK_REQUIRE_PARAMETERS=off` lets a model without strict structured-output support be used (local development currently uses the free `stealth/space-bunny-alpha` this way). The prompt then carries the JSON shape, and the reply is parsed leniently (a ```` ```json ```` fence is stripped) and validated with zod as always. They are passed as OpenRouter's `models` list, so if the primary is down or rejects the request, the next one is tried. Use the exact slugs listed on openrouter.ai/models.
- Send `HTTP-Referer` and `X-Title` headers so usage is attributed to the app on OpenRouter.

### Request settings

| Setting | Value | Why |
|---|---|---|
| `response_format` | `{ type: "json_schema", json_schema: { name: "deck", strict: true, schema } }`, with the schema generated from the zod deck schema in `protocol` | Valid JSON on models that support it |
| `provider.require_parameters` | `true` | Only route to providers that actually support structured output for this model. Otherwise the schema may be silently ignored |
| `provider.data_collection` | `"deny"` | Never route user themes to providers that may train on them. Also set the account-level privacy setting |
| `reasoning` | `{ effort: "medium" }` to start, test `"high"` for the silly pool | OpenRouter's unified reasoning setting. Models without reasoning ignore it |
| `stream` | `true` | Output is several thousand tokens. Progress events are emitted as cards are parsed from the stream |
| `max_tokens` | 32k (top-up 12k) | Room for 150 cards plus reasoning. At 16k, reasoning models ran out before writing any JSON ([eval](model-eval-2026-10.md)). A cut-off response fails the job: retrying with the same limit gets cut off again |
| Usage accounting | enabled | The response reports tokens **and cost**, which are logged on every job |

### Failures and refusals

There is no single refusal signal across providers. Treat any of these as a failed generation: `finish_reason` of `content_filter` or `length`, a refusal message instead of content, an empty `cards` list (the prompt tells the model to return one for a theme that can't be made family friendly; no top-up is attempted), JSON that fails the zod deck schema, or too few cards after cleanup and one top-up. The job is marked `failed` with a friendly message ("We couldn't make a deck for that theme"), and the credit is refunded (idempotently, see [backend-guidelines.md](backend-guidelines.md#services-and-business-logic) B16). Transport errors (429/5xx) are retried with backoff by pg-boss, at most 2 retries. Until the job queue exists, the service turns them into `SERVICE_UNAVAILABLE`. A malformed reply gets one immediate retry. A refusal or a reply cut off at the token limit doesn't (asking again rarely helps and costs money). Calls abandoned at the 180 s timeout **are still billed** by OpenRouter, so keep slow models out of the routing list.

### Prompt caching

The static system prompt is ~800 tokens, which is below the minimum cacheable size on most models, so caching saves almost nothing here. Keep the system prompt byte-identical across requests anyway. If it grows past the minimum later, OpenAI/Gemini/DeepSeek models cache automatically, and Anthropic models need `cache_control` on the system block.

## Output schema

```json
{
  "title": "Spooky Halloween",
  "description": "Ghosts, ghouls and pumpkins for your October party.",
  "tags": ["halloween", "spooky", "monsters", "october"],
  "cards": [
    {
      "text": "Witch hat",
      "difficulty": "easy",
      "silly": false,
      "alternates": ["witches hat"],
      "keywords": ["witch", "hat"]
    },
    {
      "text": "Vampire on a unicycle",
      "difficulty": "medium",
      "silly": true,
      "alternates": ["vampire riding a unicycle", "dracula on a unicycle"],
      "keywords": ["vampire", "unicycle"]
    }
  ]
}
```

Silly cards also get a `difficulty` so they work with the difficulty filter. In practice they are mostly medium/hard.

## Prompt (sketch)

**System prompt** (static, so it can be prompt-cached across all generations):

```
You create card decks for a Pictionary-style drawing game. Players draw the card
text while others guess it by typing.

Every card must be:
- Drawable by an amateur in under 80 seconds, without letters or numbers.
- Guessable by typing a short phrase. Prefer common, widely known words.
- Clearly connected to the deck's theme.
- Unique within the deck (no near-duplicates like "Ghost" and "Little ghost").

Difficulty:
- easy: one concrete, common noun a child could draw (Pumpkin, Bat).
- medium: a specific object, character or simple scene, 1–2 words (Haunted house).
- hard: abstract, action, or multi-part concept, up to 4 words (Séance, Trick or treat).
- silly: an absurd, funny mash-up of a theme character/object with an unrelated
  everyday job, activity or object (Vampire on a unicycle, Realtor skeleton,
  Ghost plowing a field). Still drawable. Max 5 words. Surprising, not random.

For each card give "alternates" (other phrasings players might type that should
count as correct) and "keywords" (the 1–3 essential concepts a guess must contain).

If family_friendly is true: nothing sexual, gory, hateful, drug-related, or about
real people. Never include slurs or content targeting a group.
```

**User message** (varies per request):

```
Theme: "halloween"
Notes from creator: "for a family party, kids aged 6+"
Language: en
family_friendly: true
Counts: easy 40, medium 40, hard 30, silly 40
```

The creator picks which difficulties the deck has and whether it gets a silly pool (`DeckGenerationRequest` in `protocol`). Only those counts are requested, and silly cards are told to use one of the chosen difficulties, because the card pool only draws cards whose difficulty the room selected.

The theme and notes are user input. Put them in clearly labelled fields and tell the model to treat them only as a theme description, never as instructions. This blocks attempts like "ignore the rules and…".

## Validation and cleanup (deterministic, after the model call)

| Check | Action |
|---|---|
| JSON schema | Requested through `response_format`, but support varies by model, so **always validate with zod**. Invalid → one retry, then fail |
| Length | `text` 2–40 chars. Drop violators |
| Characters | Letters, spaces, hyphens, apostrophes only. Drop digits, emoji |
| Duplicates | Normalize (same as guess matching) and drop duplicates, counting the same meaningful words in any order as one card ("Vampire on a unicycle" / "Unicycle vampire"). Cards that contain another card are **kept**: dropping them would remove "Witch" because of "Witch hat", and most silly cards contain a theme noun. The prompt asks for no near-duplicates instead |
| Pools | Cards with a difficulty the creator didn't pick, or silly cards when the silly pool is off, are dropped |
| Blocklist | Profanity and slur list on text, alternates, title, and tags. Drop the card. If the title or tags match, fail the whole job |
| Keywords | Each keyword must appear in text or alternates (after normalization), otherwise it's dropped. If none survive, the text's meaningful words are used, like the built-in decks |
| Counts | If any level has < 70% of the target count after cleanup → one top-up call ("Give 12 more medium cards, not in this list: …") |
| Cross-deck similarity | Compute overlap with existing decks with the same tags. If > 80% of cards duplicate an existing deck, warn the creator ("Very similar to *Spooky Halloween*") |

## Theme pre-check (before spending a credit)

A cheap synchronous check when the user submits:
1. Blocklist on the theme text.
2. Length 2–60 chars.
3. Optional: a short classification call that answers `{ok: boolean, reason}` to catch themes that are obviously abusive, and also flags themes about **real private individuals**. (Public topics like "Taylor Swift songs" are borderline. Product decision, see open questions.)

## Cost

Approximate, per full deck (150 cards with alternates and keywords): ~1k input tokens and ~6–8k output tokens including reasoning. Output dominates.

| Model (examples) | Price in / out per 1M | ≈ Cost per deck |
|---|---|---|
| Claude Opus 5.5 | $4 / $20 | $0.13–0.17 |
| Claude Sonnet 5.5 | $2 / $10 | $0.07–0.09 |
| Claude Haiku 4.5 | $1 / $5 | $0.03–0.04 |
| Other candidates | see openrouter.ai/models | filled in by the eval |

On top of that, OpenRouter charges a fee when buying credits (around 5%, check current terms). Set a **monthly spending limit** on the OpenRouter key, so a bug or abuse can't run up a bill.

Levers if costs need to come down, in order:
1. Pick a cheaper model when the eval shows the quality holds.
2. Generate fewer cards per call (e.g. 100 instead of 150) and let users "add more" later.
3. Keep `alternates` short (max 3) and drop `description` generation.
4. Lower reasoning effort on the same model.

Log input tokens, output tokens, the model and provider OpenRouter actually used, and the cost it reports on every `generation_jobs` row.

## Evaluation

The eval does two jobs: it **picks the production model**, and it guards quality whenever the prompt or model changes.

**Set-up** (`pnpm --filter @pictiotheme/server deck:eval`, in `apps/server/scripts/eval-decks.ts`, run by hand, never in CI). It caps spend against the key's real usage (`--cap`, USD), counting failed calls at their worst case. Results so far: [model-eval-2026-10.md](model-eval-2026-10.md).
- `evals/themes.json`: ~20 themes. Broad ("animals"), niche ("pirate cooking"), tricky ("the 1990s"), and adversarial (borderline content, prompt-injection attempts in the notes field).
- `evals/models.json`: the candidates. Start with Claude Opus 5.5, Claude Sonnet 5.5 and Claude Haiku 4.5, a current OpenAI flagship and its mini model, a Gemini Pro and Flash model, and one strong open-weight model (e.g. DeepSeek or Qwen).
- The script runs every theme × model through the **real production pipeline** (same prompt, same validation). It saves each deck to `evals/results/<date>/<model>/<theme>.json` and writes a summary CSV.

**Automatic metrics** (from the summary CSV): schema-valid rate, cards surviving cleanup per level, duplicate/blocklist drops, latency, cost per deck.

**Human metrics** (blind: model names are hidden and the order is shuffled), per deck:
- % of cards that are drawable.
- % of silly cards rated funny (the selling point).
- Off-theme cards.
- Safety violations (target: 0).

**Decision rule:** among models with zero safety violations and ≥ 95% schema-valid output, pick the cheapest one whose human scores are within ~10% of the best. Record the result and the chosen slug in [decisions.md](decisions.md).

In production, card-level stats (`times_guessed / times_drawn`, flags) are an ongoing quality signal.

## Curated seed decks

Before launch, generate (with the model the eval picked, via the same script) and hand-edit ~30 decks covering the most common themes (Halloween, Christmas, Animals, Food, Sports, Movies, Jobs, Space, Ocean, School, Office, Fantasy…). Users then find something good on day one, and the library looks full.
