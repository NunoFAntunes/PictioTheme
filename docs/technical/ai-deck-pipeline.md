# AI Deck Generation Pipeline

## Goals

- Produce a **good, drawable, themed** deck in one request: easy and hard cards, plus (optionally) its Chaos cards with a second call. Chaos cards can also be added to any deck later.
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

The pipeline steps above run in `generation.service.ts` (plus the [theme check](#theme-check) before the job, and [translations](#translation) and [Chaos cards for an existing deck](#chaos-cards-for-an-existing-deck) as other kinds of job). A new deck is two model calls: its easy and hard cards (`SYSTEM_PROMPT`, `deck-prompt.ts`), then, when the creator asked for them, its Chaos cards (`CHAOS_PROMPT`, `chaos-prompt.ts`) made from the first call's cards. Each call has its own cleanup and one top-up. If the Chaos call fails, the deck is saved without Chaos cards (`chaosFailed` in the log). Around them, `generation-jobs.service.ts` runs each generation **in-process** as a row in `generation_jobs`: `POST /api/decks/generations` inserts the job and starts it without waiting, the client polls `GET /api/decks/generations/:id`, and the finished deck is saved through the decks service (`decks`/`cards` tables) with no review step. A restart fails any running job at boot. While a job runs (or after it's published), its creator can attach the drawn [back cover](../product/decks.md#back-cover) with `PUT /api/decks/generations/:id/cover`; the job holds it and it's copied onto the deck whichever of the two finishes last. Later, `PUT /api/decks/:id/cover` redraws it: the published job with that `deck_id` and the caller as `created_by` is the ownership check. Generation is on for everyone, guests included, within daily limits checked before a job starts: 1 deck per player and 3 per IP in any 24 hours (failed jobs don't count), and a global daily budget (running jobs count at an estimated $0.02). `DECK_GENERATION=off` is the kill switch, and the feature reports itself off when there's no API key. The theme pre-check (blocklist on theme and notes) runs before the job is created, and the blocklist runs again on the cards, alternates, title and tags (`content-check.ts`). Still to come from the flow above: auth and credits, pg-boss, streaming progress, the review step, and the optional LLM theme check.

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
| `reasoning` | `{ effort: "medium" }` to start, test `"high"` for the Chaos cards | OpenRouter's unified reasoning setting. Models without reasoning ignore it |
| `stream` | `true` | Output is several thousand tokens. Progress events are emitted as cards are parsed from the stream |
| `max_tokens` | 32k (Chaos 24k, top-ups 12k) | Room for 90 cards plus reasoning. At 16k, reasoning models ran out before writing any JSON ([eval](model-eval-2026-10.md)). A cut-off response fails the job: retrying with the same limit gets cut off again |
| Usage accounting | enabled | The response reports tokens **and cost**, which are logged on every job |

### Failures and refusals

There is no single refusal signal across providers. Treat any of these as a failed generation: `finish_reason` of `content_filter` or `length`, a refusal message instead of content, an empty `cards` list (the prompt tells the model to return one for a theme that can't be made family friendly; no top-up is attempted), JSON that fails the zod deck schema, or too few cards after cleanup and one top-up. The job is marked `failed` with a friendly message ("We couldn't make a deck for that theme"), and the credit is refunded (idempotently, see [backend-guidelines.md](backend-guidelines.md#services-and-business-logic) B16). Transport errors (429/5xx) are retried with backoff by pg-boss, at most 2 retries. Until the job queue exists, the service turns them into `SERVICE_UNAVAILABLE`. A malformed reply gets one immediate retry. A refusal or a reply cut off at the token limit doesn't (asking again rarely helps and costs money). Calls abandoned at the 180 s timeout **are still billed** by OpenRouter, so keep slow models out of the routing list.

### Prompt caching

The static system prompt is ~800 tokens, which is below the minimum cacheable size on most models, so caching saves almost nothing here. Keep the system prompt byte-identical across requests anyway. If it grows past the minimum later, OpenAI/Gemini/DeepSeek models cache automatically, and Anthropic models need `cache_control` on the system block.

## Output schema

The deck call (`LlmDeckOutput` in `generation.schemas.ts`):

```json
{
  "title": "Spooky Halloween",
  "description": "Ghosts, ghouls and pumpkins for your October party.",
  "tags": ["halloween", "spooky", "monsters", "october"],
  "cards": [
    { "text": "Witch hat", "difficulty": "easy", "alternates": ["witches hat"], "keywords": ["witch", "hat"] },
    { "text": "Witch stirring a cauldron", "difficulty": "hard", "alternates": [], "keywords": ["witch", "cauldron"] }
  ]
}
```

The Chaos call (`LlmChaosOutput`). `subject`, `hook` and `twist` come before `text`, so the model reasons about the joke before it writes the card; cleanup uses `subject` and `twist`, and none of the three is saved:

```json
{
  "cards": [
    {
      "subject": "Paper shredder",
      "hook": "shreds paper into strips, like spaghetti",
      "twist": "making spaghetti",
      "text": "Paper shredder making spaghetti",
      "alternates": ["shredder making spaghetti"],
      "keywords": ["shredder", "spaghetti"]
    }
  ]
}
```

Saved cards have one `kind`: `easy`, `hard` or `chaos` (`Card` in protocol). Chaos cards have no difficulty.

## Prompts

Both system prompts are static (user input only goes in the user message), share the rules every card follows (drawable, alternates and keywords, guardrails, language, untrusted input), and end with the JSON shape for models that don't enforce the schema. The eval script can swap either one for a variant (`scripts/eval/prompts.ts`).

### Easy and hard cards

The deck prompt asks for 50 easy and 40 hard cards (`TARGET_COUNTS`). Medium was removed on 2026-10-11 ([decisions.md](decisions.md) D12): with names as easy cards, the only way for a model to make a card "more specific" was to stick a label on the name ("Cassiopeia snake queen", "Cho'Gath void monster" in a League of Legends deck), which gives the drawer nothing more to draw. The two levels are now different kinds of card, not degrees:

- **easy, "name it"**: one iconic thing recognisable from a single drawing, 1–3 words, the name alone. For franchise themes, the most famous characters, items and places, never deep cuts ("a game with 170 characters still has only about 30 most players would recognise").
- **hard, "show it"**: a small scene, a subject doing something or two things in a meaningful relationship, 2–5 words. The action comes from the subject: its signature ability, habit, famous moment, partner, tool or home ("Annie summoning Tibbers", "Teemo planting a mushroom", "Milking a cow").
- **The swap test**: replace the subject with another one from the theme. If the card makes just as much sense ("Tin Man reading a book"), it's generic.
- **Never a label on a name** ("Muddy pig", "Farm hat").

Examples are a Farm deck and a story theme (The Wizard of Oz, public domain), with good and bad cards for each level and the reason each bad one is bad. The method asks the model to rank ~80 subjects by fame, take easy cards from the top, and build hard cards from what each best-known subject is famous for.

### Chaos cards

Chaos cards are what Chaos mode plays with ([game-rules.md](../product/game-rules.md#card-pool)). They replaced the silly cards on 2026-10-11. The silly prompt asked for "a theme character or object with an unrelated everyday activity", and its method paired a list of subjects with a list of everyday activities. Across the 22 decks in the database (815 silly cards), that produced "[theme noun] + [stock activity]": "walking a dog" was on 18 decks, "painting a fence" on 16, "mowing the lawn" on 15, and a third of all silly cards used a stock activity ("Laminator painting a fence", "Whiteboard flying a kite"). They were drawable but not funny, because the activity had nothing to do with the noun.

The Chaos prompt (`chaos-prompt.ts`) flips it: **the joke comes from the subject**. One subject from the deck goes into a situation that plays on what it *is* (shape, body, job, home, famous trait, weakness), and bends that trait: the wrong place, the wrong scale, the wrong way round, or much too far. It lists the patterns that work (trait in the wrong place: "Snowman in a sauna"; job taken too far: "Paper shredder making spaghetti"; role reversal: "Mouse chasing a cat"; body used for something else: "Giraffe cleaning windows"; suffering its own trait: "Vampire buying sunscreen"; the perfect job: "Realtor skeleton") and two failure modes, each with bad examples:

- **Generic** (fails the swap test): "Laminator painting a fence", "Wizard mowing a lawn".
- **Just its job**: "Spatula flipping a pancake", "Magikarp climbing a waterfall": that's a hard card. Pushed: "Spatula flipping the chef", "Magikarp in a goldfish bowl".

Plus: each twist at most once per deck, near-repeats included; no subject in more than 3 cards and at least 20 subjects; stock activities only when the joke is about the subject ("Dog walking its owner"); objects only when the joke uses what they do; skip subjects without a joke instead of going down the list; 2–5 words; the joke visible, never wordplay. The user message gives the theme, the deck's description and notes, the language, and the deck's cards as the subjects to build on (and any Chaos cards it already has, not to repeat). It asks for 50 (`CHAOS_TARGET`).

Cleanup enforces the variety rules the prompt can't guarantee (`cleanChaosCards`, below). Measured with `deck:quality` on the eval themes (2026-10-11, `openai/gpt-6-luna`): stock activities went from 33.6% of silly cards to ~2% of Chaos cards, with no twist repeated within a deck. The League of Legends deck got Chaos cards like "Caitlyn using her rifle as a telescope", "Nidalee chasing a laser dot" and "Malphite as a garden gnome"; the Office deck got "Computer mouse in a mousetrap" and "Stapler chomping a sandwich".

### User message

```
Theme: "halloween"
Notes from creator: "for a family party, kids aged 6+"
Language: en (English)
Counts:
- easy: 50 cards
- hard: 40 cards
```

The theme and notes are user input. Put them in clearly labelled fields and tell the model to treat them only as a theme description, never as instructions. This blocks attempts like "ignore the rules and…". A saved deck's title and description, used for Chaos cards added later, came from users too and are treated the same way.

The deck's language (`DeckGenerationRequest.language`, the room's language) is on the user message's `Language:` line with the regional variant spelled out ("European Portuguese as spoken in Portugal (not Brazilian Portuguese)", `DECK_LANGUAGES[].prompt`). The static system prompt makes it a rule that holds whatever the theme or notes say: every text, alternate, keyword, title, description and tag in that language and region, cards are what players there would type (not literal translations of English cards), franchises use their local names, and English-only wordplay is skipped. Cleanup enforces the deterministic half: a card not written in the language's script is dropped (see the table below), which can trigger the top-up and fail the job.

## Validation and cleanup (deterministic, after the model call)

| Check | Action |
|---|---|
| JSON schema | Requested through `response_format`, but support varies by model, so **always validate with zod**. Invalid → one retry, then fail |
| Length | `text` 2–40 chars. Drop violators |
| Characters | Letters, spaces, hyphens, apostrophes only. Drop digits, emoji |
| Script | The card must be written in the deck language's script (`isInLanguageScript` in game-core): only Latin letters for Latin-script languages; at least one letter of its own script for the others (kana or kanji for Japanese, Hangul for Korean, Han for Chinese, Cyrillic, Greek), Latin letters allowed alongside ("Tシャツ"). Drop violators. Alternates may also be in Latin letters ("Pikachu" in a Japanese deck) |
| Duplicates | Normalize (same as guess matching) and drop duplicates, counting the same meaningful words in any order as one card ("Vampire on a unicycle" / "Unicycle vampire"). Cards that contain another card are **kept**: dropping them would remove "Witch" because of "Witch hat", and most hard and Chaos cards contain a theme noun. The prompt asks for no near-duplicates instead. Chaos cards are also checked against the deck's easy and hard cards |
| Kinds | The deck call's schema only allows `easy` and `hard`, so a "medium" card fails the reply (retried once) |
| Labels | A hard card that is one of the deck's easy cards plus words with no action or relation in them (no "-ing" word, no preposition or article: "Cassiopeia snake queen", "Muddy pig") is dropped (`isLabelledName`). English only; other languages rely on the prompt |
| Chaos variety | `cleanChaosCards`: a card without a `hook` is dropped; a twist the deck already has is dropped (same words, one's words inside the other's, or the same last word: "making spaghetti" / "eating spaghetti"); a subject's 4th card is dropped; past 3 stock activities per deck (walking a dog, painting a fence, yoga, kite, lawn, bicycle…, matched on the twist so "Dog walking its owner" passes; English only), the rest are dropped. These limits carry over to the top-up |
| Blocklist | Profanity and slur list on text, alternates, title, and tags. Drop the card. If the title or tags match, fail the whole job |
| Keywords | Each keyword must appear in text or alternates (after normalization), otherwise it's dropped. If none survive, the text's meaningful words are used, like the built-in decks |
| Counts | If easy or hard has < 70% of its target after cleanup → one top-up call for the missing ones, listing the deck's cards ("- hard: 13 cards", "This deck already has these cards: …"). The same for Chaos cards in their own call (target 50, at least 35) |
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

The model gets the deck as JSON (`id`, text, alternates, kind) and returns each card it keeps by `id`, with its text, alternates and keywords in the target language, plus the ones it dropped and why (for the logs). The prompt's rules: translate to what a native speaker would type for the picture; keep names players there use unchanged; use the **local official name** for franchises and characters (Pokémon names change in German, French and Japanese; when unsure of the official name, drop the card rather than invent one); adapt cards whose literal translation wouldn't be drawn or guessed the same way; **drop** cards that don't work in the language or culture (puns, rhymes, unknown things, a translation that repeats another card); keep each card family friendly in the target language.

After the call: the kind comes from the original card (the model can't move a card between pools), unknown or repeated ids are ignored, and the cards go through the same cleanup as a new deck (length, characters, script, blocklist, duplicates, keywords). Fewer than 60% of the original's cards left → the job fails with "This deck doesn't translate well into that language". A malformed reply is retried once. Covers are copied from the original when the translation is saved; a translation can't have its cover redrawn and doesn't appear in anyone's "Your decks".

Limits: 5 new translations per player and 15 per IP in any 24 hours (`GENERATION_TRANSLATIONS_PER_*`), counted apart from generations, within the shared daily budget. `DECK_GENERATION=off` turns translations off too; translations that already exist can still be picked.

A translation made after its original got Chaos cards carries them over; one made before doesn't, and gets its own (see below).

## Chaos cards for an existing deck

Built 2026-10-11 (`addChaos` in `generation-jobs.service.ts`, `makeChaosCards` in `generation.service.ts`). Not every deck has Chaos cards: a creator can leave them out, a Chaos call can fail, and the curated decks and decks made before Chaos mode have none. Any host can add them, to any deck, because rooms need them right away (decks.md#chaos-cards).

`POST /api/decks/:id/chaos` returns:
- `{ status: 'ready', deck }` when the deck already has at least `CHAOS_MIN_CARDS` (10), and
- `{ status: 'generating', job }` otherwise: a running Chaos job for that deck is joined (unique index `generation_jobs_one_chaos_idx` on running chaos jobs settles races), or a new job of kind `chaos` starts, with `source_deck_id` the deck. Like translations, Chaos jobs are readable by anyone polling `GET /api/decks/generations/:id`.

The job runs the same Chaos call and cleanup as a new deck, with the saved deck's title as the theme, its description, no notes, its language, its easy and hard cards as the subjects, and any Chaos cards it already has as cards not to repeat (it asks for 50 minus those). The cards are added to the deck (`insertCards`, skipping texts it has), and every room whose deck it is loads it again (`onDeckCardsAdded` → `rooms.reloadDeck`), which sends `room:settings` with the new `chaosCards` count. Adding Chaos cards doesn't make the deck yours: ownership (redrawing the cover, "Your decks") stays with the `generate` job. Each language row of a family is its own deck, so each gets Chaos cards written natively in its language rather than translated. A curated deck re-seeded from a JSON file without Chaos cards keeps the ones a host made.

Limits: 5 per player and 15 per IP in any 24 hours (`GENERATION_CHAOS_PER_*`), within the shared daily budget. A failed job ("We couldn't make Chaos cards for this deck") doesn't count and can be tried again.

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

**Set-up** (`pnpm --filter @pictiotheme/server deck:eval`, in `apps/server/scripts/eval-decks.ts`, run by hand, never in CI). It caps spend against the key's real usage (`--cap`, USD: the key's total, not this run's), counting failed calls at their worst case. Results so far: [model-eval-2026-10.md](model-eval-2026-10.md). `--prompts` and `--chaos-prompt` pick prompt variants from `scripts/eval/prompts.ts`.
- `evals/themes.json`: broad ("space"), everyday ("in the kitchen", "office life": objects without personality, the hardest for Chaos cards), franchises ("League of Legends", "Pokémon": famous names for easy, signature scenes for hard), tricky ("the 1990s"), and adversarial (borderline content, prompt-injection attempts in the notes field).
- `evals/models.json`: the candidates. Start with Claude Opus 5.5, Claude Sonnet 5.5 and Claude Haiku 4.5, a current OpenAI flagship and its mini model, a Gemini Pro and Flash model, and one strong open-weight model (e.g. DeepSeek or Qwen).
- The script runs every theme × model through the **real production pipeline** (same prompt, same validation). It saves each deck to `evals/results/<date>/<model>/<theme>.json` and writes a summary CSV.

**Automatic metrics**: schema-valid rate, cards surviving cleanup per kind, drops by reason, latency, cost per deck, and the quality numbers from `scripts/eval/quality.ts`: the share of Chaos cards using a stock activity, twists repeated within a deck and across decks (the most repeated ones are listed), the top subject's share, and the share of hard cards that are a label on a name. `pnpm --filter @pictiotheme/server deck:quality <decks.json | results folder>` prints them for any set of decks, free (a dump of the database's decks on 2026-10-11 is the baseline above).

**Human metrics** (blind: model names are hidden and the order is shuffled), per deck:
- % of cards that are drawable.
- % of Chaos cards rated funny (the selling point), and % that pass the swap test.
- % of hard cards that are a real scene rather than a name with a label.
- Off-theme cards.
- Safety violations (target: 0).

**Decision rule:** among models with zero safety violations and ≥ 95% schema-valid output, pick the cheapest one whose human scores are within ~10% of the best. Record the result and the chosen slug in [decisions.md](decisions.md).

In production, card-level stats (`times_guessed / times_drawn`, flags) are an ongoing quality signal.

## Curated seed decks

Before launch, generate (with the model the eval picked, via the same script) and hand-edit ~30 decks covering the most common themes (Halloween, Christmas, Animals, Food, Sports, Movies, Jobs, Space, Ocean, School, Office, Fantasy…). Users then find something good on day one, and the library looks full.
