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

The pipeline steps above run in `generation.service.ts` (plus the [theme check](#theme-check) before the job, and [translations](#translation) as a second kind of job). Around them, `generation-jobs.service.ts` runs each generation **in-process** as a row in `generation_jobs`: `POST /api/decks/generations` inserts the job and starts it without waiting, the client polls `GET /api/decks/generations/:id`, and the finished deck is saved through the decks service (`decks`/`cards` tables) with no review step. A restart fails any running job at boot. While a job runs (or after it's published), its creator can attach the drawn [back cover](../product/decks.md#back-cover) with `PUT /api/decks/generations/:id/cover`; the job holds it and it's copied onto the deck whichever of the two finishes last. Later, `PUT /api/decks/:id/cover` redraws it: the published job with that `deck_id` and the caller as `created_by` is the ownership check. Generation is on for everyone, guests included, within daily limits checked before a job starts: 1 deck per player and 3 per IP in any 24 hours (failed jobs don't count), and a global daily budget (running jobs count at an estimated $0.02). `DECK_GENERATION=off` is the kill switch, and the feature reports itself off when there's no API key. The theme pre-check (blocklist on theme and notes) runs before the job is created, and the blocklist runs again on the cards, alternates, title and tags (`content-check.ts`). Still to come from the flow above: auth and credits, pg-boss, streaming progress, the review step, and the optional LLM theme check.

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

The deck's language (`DeckGenerationRequest.language`, the room's language) is on the user message's `Language:` line with the regional variant spelled out ("European Portuguese as spoken in Portugal (not Brazilian Portuguese)", `DECK_LANGUAGES[].prompt`). The static system prompt makes it a rule that holds whatever the theme or notes say: every text, alternate, keyword, title, description and tag in that language and region, cards are what players there would type (not literal translations of English cards), franchises use their local names, and English-only wordplay is skipped. Cleanup enforces the deterministic half: a card not written in the language's script is dropped (see the table below), which can trigger the top-up and fail the job.

## Validation and cleanup (deterministic, after the model call)

| Check | Action |
|---|---|
| JSON schema | Requested through `response_format`, but support varies by model, so **always validate with zod**. Invalid → one retry, then fail |
| Length | `text` 2–40 chars. Drop violators |
| Characters | Letters, spaces, hyphens, apostrophes only. Drop digits, emoji |
| Script | The card must be written in the deck language's script (`isInLanguageScript` in game-core): only Latin letters for Latin-script languages; at least one letter of its own script for the others (kana or kanji for Japanese, Hangul for Korean, Han for Chinese, Cyrillic, Greek), Latin letters allowed alongside ("Tシャツ"). Drop violators. Alternates may also be in Latin letters ("Pikachu" in a Japanese deck) |
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
3. The theme check below.
4. Optional, later: flag themes about **real private individuals**. (Public topics like "Taylor Swift songs" are borderline. Product decision, see open questions.)

## Theme check

Built 2026-10-07 (`theme-check.ts`). One quick model call (`reasoning: low`, 2k tokens, on its own model: `THEME_CHECK_MODEL`, by default the deck model, see [the eval](model-eval-2026-10.md#theme-check)) runs in `POST /api/decks/generations` after the blocklist and the daily limits and **before the job is created**, so a refused theme never starts a job, never uses up the player's daily deck, and the player sees the reason right away in the form. It answers:

```json
{ "writtenIn": "German", "matchesLanguage": true, "quality": 4, "reason": "…" }
```

- `matchesLanguage: false` → 422 `THEME_WRONG_LANGUAGE`: "Your theme looks like English, but this room plays in German (Deutsch). Write the theme in German, or change the room's language." Names and words used unchanged across languages ("Pokémon", "Halloween", "Pizza") count as neutral and match any language; regional variants of the same language match. The model's `writtenIn` only goes into the message if it's a short plain name.
- `quality` (1–5: can a family-friendly deck of 100+ varied, drawable cards come from it?) below 3 → 422 `THEME_UNCLEAR`. 1 is gibberish, 2 is meaningful but unusable (far too vague or narrow, or only an instruction).
- A refusal → 400 `VALIDATION` ("We can't make a deck about that").
- A malformed reply is retried once; an unreadable or truncated reply after that lets the theme through: the generation has its own guardrails, and a flaky check shouldn't block every deck. A busy model → 503, like generation.

Every check is recorded in `theme_checks` with its verdict and cost (~$0.0001 with luna): the daily budget counts it like a job's. Refused themes never become jobs, so they don't count against the daily deck; instead, after 20 refused checks per player or 60 per IP in 24 hours (`GENERATION_REFUSED_CHECKS_PER_*`) the endpoint answers 429 without calling the model. Switching to a cheaper model is one env line (`THEME_CHECK_MODEL=openai/gpt-oss-20b`); when the check model isn't the deck model, it falls back to the deck model. The generator doesn't self-score its deck: a model grading its own output is a weak signal, and the deterministic cleanup plus the pool counts already fail decks that came out thin.

## Translation

Built 2026-10-07 (`translate-prompt.ts`, `translateDeck` in `generation.service.ts`, jobs in `generation-jobs.service.ts`). A translation is a deck of its own: `decks.source_deck_id` points at the original and `language` says what it's in, unique per original and language. Translations are always made from the original, so errors never compound.

`POST /api/decks/:id/translations { language }` (any deck of the family) returns:
- `{ status: 'ready', deck }` when the family already has that language (or it's the original's language), and
- `{ status: 'translating', job }` otherwise: a running translation of the same original and language is joined (a unique index on running translate jobs settles races), or a new job starts. Translation jobs are readable by anyone polling `GET /api/decks/generations/:id`, since several hosts can wait on one; they show only the deck's title.

The model gets the deck as JSON (`id`, text, alternates, difficulty, silly) and returns each card it keeps by `id`, with its text, alternates and keywords in the target language, plus the ones it dropped and why (for the logs). The prompt's rules: translate to what a native speaker would type for the picture; keep names players there use unchanged; use the **local official name** for franchises and characters (Pokémon names change in German, French and Japanese; when unsure of the official name, drop the card rather than invent one); adapt cards whose literal translation wouldn't be drawn or guessed the same way; **drop** cards that don't work in the language or culture (puns, rhymes, unknown things, a translation that repeats another card); keep each card family friendly in the target language.

After the call: difficulty and silliness come from the original card (the model can't move a card between pools), unknown or repeated ids are ignored, and the cards go through the same cleanup as a new deck (length, characters, script, blocklist, duplicates, keywords). Fewer than 60% of the original's cards left → the job fails with "This deck doesn't translate well into that language". A malformed reply is retried once. Covers are copied from the original when the translation is saved; a translation can't have its cover redrawn and doesn't appear in anyone's "Your decks".

Limits: 5 new translations per player and 15 per IP in any 24 hours (`GENERATION_TRANSLATIONS_PER_*`), counted apart from generations, within the shared daily budget. `DECK_GENERATION=off` turns translations off too; translations that already exist can still be picked.

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
