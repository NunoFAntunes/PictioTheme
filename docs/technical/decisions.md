# Technical Decisions

A log of locked technical decisions. Each entry says what was chosen, why, what was rejected, and when to revisit. To change a decision, add a new entry that supersedes the old one instead of editing it.

Overall constraint behind all of them: **hosting cost as close to zero as possible.** An existing VM and a domain are already paid for.

---

## D1 — Self-hosted PostgreSQL on the VM

**Date:** 2026-10-03 · **Status:** accepted

**Decision:** PostgreSQL 18 in Docker on the VM, with nightly `pg_dump` to Cloudflare R2. Drizzle ORM for schema and migrations.

**Why:** Free, with no size caps, pausing or cold starts. Every extension is available (`pg_trgm`, full-text search), and Postgres 18 has native `uuidv7()`. It runs next to the game server, so latency is lowest. The data (users, decks, credit ledger) is relational and small.

**Alternatives considered (rating /10):**

| Option | Rating | Why not |
|---|---|---|
| **Self-hosted Postgres** | **9** | Chosen. Cost: backups and upgrades are our job |
| Supabase free | 7.5 | Free projects pause after about a week of inactivity, no point-in-time recovery on free, and its Realtime doesn't help an authoritative game server. Main benefit (Auth) is covered by Better Auth |
| SQLite + Litestream | 7.5 | Simplest to run, but no `pg_trgm`, and moving to multiple servers later means migrating |
| Neon free | 7 | Cold starts after idle, monthly compute cap |
| Cloudflare D1 | 5 | Only makes sense with an all-Cloudflare backend |
| Firebase / MongoDB | 3 | Poor fit for a credit ledger and relational decks |

**Revisit when:** the VM becomes a reliability problem, or we need high availability. Drizzle on `pg` makes moving to a managed Postgres a connection-string change.

---

## D2 — Fastify (TypeScript) modular monolith, one process

**Date:** 2026-10-03 · **Status:** accepted

**Decision:** Fastify 5 on Node 24 LTS, with `@fastify/websocket` (`ws`) for rooms and pg-boss for jobs, all **in one process** on the VM. No Redis for now. Code organization is defined in [backend-guidelines.md](backend-guidelines.md).

**Why Fastify over Hono:** on Node, Fastify is the faster of the two, because Hono's Node adapter converts every request to Web-standard objects. Its plugin **encapsulation**, hooks, built-in pino logging and schema-based validation and serialization give a structure that can be enforced, which matters for keeping a solo codebase tidy. Hono's main advantage, running on edge runtimes, doesn't matter on a VM.

**Why one process:** one VM, minimal operations. In-memory maps replace Redis (room registry, rate limits, event bus), each behind an interface so Redis can be added when there's a second instance.

**Alternatives considered (rating /10):**

| Option | Rating | Why not |
|---|---|---|
| **Fastify + ws** | **9** | Chosen |
| Hono + ws | 8.5 | Fine, but slower on Node and less built-in structure |
| Colyseus | 7.5 | Its automatic state sync fits poorly with "different data per recipient" (secret word, redacted guesses) |
| Cloudflare Durable Objects | 7 | Lock-in and a different runtime. Unnecessary with a VM. Remains the global-scale escape hatch (`game-core` stays runtime-agnostic) |
| Socket.IO | 7 | Protocol overhead, and its rooms are only broadcast groups |
| NestJS | 6 | Heavy decorator and DI boilerplate for a solo developer. The core logic is a pure state machine that gains nothing from it |
| Phoenix / Go | 5–6 | We'd lose shared TypeScript types for the protocol and deck schema |

**Revisit when:** one process can't hold the concurrent rooms (see the [scaling path](architecture.md#scaling-path)).

---

## D3 — Astro (static) + React SPA, served from the VM

**Date:** 2026-10-03 · **Status:** accepted

**Decision:** Astro with static output for landing, legal and marketing pages. React (Vite, via Astro's integration) for the app, mounted on a single shell page with React Router. Caddy serves everything from the same origin as the API, and Cloudflare caches static assets. Rules are in [frontend-guidelines.md](frontend-guidelines.md).

**Why:** Static pages are fast and good for SEO with no JS. The game is a client-side canvas app where SSR adds nothing. Static output means no frontend server and no hosting bill. Same origin means no CORS and simple cookies. React has the largest ecosystem (shadcn/ui, `perfect-freehand`, TanStack Query).

**Alternatives considered (rating /10):**

| Option | Rating | Why not |
|---|---|---|
| **Astro + React** | **8.5** | Chosen |
| Vite + React SPA only | 9 | Simplest option, but no good static/SEO pages for landing |
| SvelteKit | 8 | Smaller ecosystem |
| Next.js | 6 | Vercel Hobby forbids commercial use. Self-hosting adds a Node process. SSR adds little to a canvas game |
| Vue / Solid | 6.5–7 | No advantage for this app |

**Revisit when:** deck pages need to be indexed by search engines. Then add the Astro Node adapter for those routes only.

---

## D4 — OpenRouter for model inference

**Date:** 2026-10-03 · **Status:** accepted (the first eval picked a model: D6)

**Decision:** Call models through OpenRouter's OpenAI-compatible API, behind an `LlmClient` interface in the `generation` module. Model slugs come from config. Details are in [ai-deck-pipeline.md](ai-deck-pipeline.md).

**Why:** We need to **test several models** (Anthropic, OpenAI, Google, open-weight) on deck quality, especially how funny the silly prompts are, using one key, one API and one bill. OpenRouter also offers fallback routing across models and providers.

**Known trade-offs:**
- A fee on credit purchases (around 5%, check current terms).
- Support for structured outputs and prompt caching varies by model and provider. We require providers that support our parameters, and validate output with zod anyway.
- An extra network hop.
- `:free` model variants are rate-limited, unreliable and may log prompts. They are **only for local experiments, never production**.

**Alternatives considered (rating /10):** Anthropic direct 9 (best for one vendor, no markup), **OpenRouter 7 → chosen because multi-model testing is a requirement**, OpenAI direct 7, Gemini 6.5, cheap open-weight hosts 5, self-hosted on the VM 2 (too slow on CPU, too weak at humour).

**Revisit when:** the eval picks a winner. If one vendor clearly wins and volume grows, compare the OpenRouter fee and feature gaps with going direct. Because of the `LlmClient` interface, that's a change of one adapter.

---

## D5 — Hosting topology

**Date:** 2026-10-03 · **Status:** accepted

**Decision:** Cloudflare free plan (DNS + proxy) → VM running Docker Compose: Caddy, the server, Postgres. Deploys run from GitHub Actions to the VM over SSH. Backups go to Cloudflare R2.

**Why:** €0 beyond the existing VM and domain. Cloudflare hides the VM IP, absorbs attacks and caches static files.

**Accepted risk:** the VM is a single point of failure, and a deploy ends live games (v1).

---

## D6 — Deck model and prompt: gpt-6-luna with the examples prompt

**Date:** 2026-10-03 · **Status:** accepted

**Decision:** Generate decks with `openai/gpt-6-luna`, falling back to `openai/gpt-6-luna-pro`, using the `v3-examples` system prompt (rules plus good/bad examples and a method for silly cards). Both are config defaults (`DECK_MODEL`, `DECK_FALLBACK_MODELS`).

**Why:** In a blind-graded eval of 11 models and 3 prompts on 5 themes ([model-eval-2026-10.md](model-eval-2026-10.md)), gpt-6-luna tied for the best decks (7.2–7.4/10), produced all 15 decks, ignored a prompt injection, and cost ~$0.004 per deck in ~1 minute. luna-pro is marginally better at 3× the price and ~2× the time, so it's the fallback. The examples prompt scored best on average and helps the weaker models most.

**Accepted risk:** the primary and the fallback are the same vendor, so an OpenAI outage stops generation. No other vendor in the eval came close on safety and quality at this price.

**Revisit when:** the eval is re-run (new models, prompt changes), or an untested stronger model (e.g. Claude Sonnet 5.5, not in the eval because of its $1 cap) is worth its cost.

## D7 — Deck covers in their own content-addressed table

**Date:** 2026-10-04 · **Status:** accepted

**Decision:** Drawn deck covers are stored in a `deck_covers` table owned by the `decks` module (id = hash of the PNG, `bytea`), referenced by `decks.cover_id` and `generation_jobs.cover_id`. PNG checks and content ids are shared with avatars through `lib/png.ts`. Covers are uploaded to the **generation job**, not the deck, because the creator draws while the deck doesn't exist yet.

**Alternatives:** generalizing `avatars` into an `images` module with a `kind` column (fewer tables, but avatars and covers have different owners, sizes, lifecycles and moderation); object storage such as R2 (not worth the moving part at this size: a cover is ~10–50 KB).

**Revisit when:** images move to object storage or a CDN, or a third kind of drawn image appears.

## D8 — Curated decks as JSON in the repo, seeded by the migrate step

**Date:** 2026-10-04 · **Status:** accepted

**Decision:** The decks that ship with the game (the former built-in decks plus generated-and-checked ones) are JSON files in `apps/server/src/modules/decks/curated/`, one per deck, named by slug. `db:migrate` seeds them into `decks`/`cards` after the migrations, upserting by slug so a deck keeps its id and cover. Rooms load every deck from the database; there are no decks in code any more.

**Alternatives:** keeping decks in TypeScript (no covers, reports or search, since those need a database row); an admin UI to manage them (not worth it before there's a moderator page); seeding at server boot (runs on every restart, and races if there are ever two instances).

**Revisit when:** curated decks get card stats (re-seeding replaces their cards, so stats need a merge by text), or editing them moves into an admin page.

## D9 — `obscenity` for profanity detection

**Date:** 2026-10-04 · **Status:** accepted

**Decision:** Chat, guesses, names and generated decks are checked with the `obscenity` npm package (English dataset and recommended transformers: leetspeak, repeated letters, spacing), wrapped in `game-core/src/moderation/profanity.ts` with our own list of allowed phrases ("Moby Dick", "Cockpit", "Shiitake"). Masking covers the whole word. Generation adds a short list of themes unsuitable for a party game (`generation/content-check.ts`).

**Alternatives:** our own word list (easy to start, but leetspeak and false positives like "Scunthorpe" are the hard part); an LLM moderation call (costs a call per message; kept as an option for themes only).

**Revisit when:** other languages arrive (the dataset is English only), or false positives show up in real chat.

## D10 — Deck languages: translations as decks of their own, checked by the model

**Date:** 2026-10-07 · **Status:** accepted

**Decision:** A room has a language (`settings.language`) and every deck has one (`decks.language`). A translation is its own `decks` row pointing at its original (`source_deck_id`, unique per original and language), always translated from the original, made once by an AI job and shared by every later room. A match starts only with a deck in the room's language (game-core). Generation makes the language a rule in the static prompt and drops cards outside the language's script; a quick model call (the theme check) refuses themes written in another language or too unclear for a deck, before the job exists. 27 languages, chosen for the model's quality and for scripts the game handles; flags are SVGs (`country-flag-icons`), not emoji.

**Alternatives:** translated texts as columns or a JSON map on `cards` (one row per card, but stats, votes, reports and dedupe are all per deck and the card counts differ per language once cards are dropped); translating on the fly per room (pays for the same translation again and again, and a minute's wait every time); a local language detector instead of the theme check (unreliable on two-word themes, and can't tell "Pokémon" is neutral); asking the generator to grade its own deck (a weak signal; the pool counts already fail thin decks); free-text languages (the model's quality and our script handling vary too much to promise).

**Consequences:** the theme check fails open when its reply can't be read (generation still has its guardrails); it isn't counted in the daily budget. The profanity filter (D9) and plural folding are still English-only, so other languages lean on the model's guardrails and alternates. Translations keep the original's cover as it was when translated, and are reported and hidden on their own.

**Revisit when:** players ask for a language we left out (RTL and combining-mark scripts need hint/mask work first), cards in other languages get poor guess rates in card stats, or curated decks should get hand-checked translations.

## D11 — Voice guesses: the browser's speech recognition, tap or hold one mic button

**Date:** 2026-10-08 · **Status:** accepted

**Decision:** Guessers can say a guess instead of typing it, through the browser's Web Speech API. The text field stays where it is and a mic button sits beside it: hold it while you talk and let go, or tap it to leave it open and say guess after guess. Spoken guesses don't wait for the recogniser's end of speech (about a second of silence, then a network round trip for the final words): what it has heard goes out once it stops changing for 400 ms, or the moment you let go, and the final words follow only if they differ. Spoken chat goes into the field to be checked. Only the recogniser's top result counts, and the words travel as an ordinary `guess`, so nothing changes on the server or in the protocol.

**Alternatives:** a type/talk toggle (one more state to remember and switch back mid-turn, when typing and speaking can simply sit side by side); hold-only push-to-talk (awkward with a trackpad and for keyboard users) or tap-only (cuts off people who pause mid-phrase, and you can't end it exactly when you want); waiting for the recogniser's final result (safest, but a second or more slower in a race); sending every new word as it's heard (fastest, but floods the feed with half-phrases); putting every spoken guess in the field to confirm with Enter (one more step in a race, and a wrong guess costs nothing); checking all the recogniser's alternatives against the word (several guesses for each typed one); Whisper or Moonshine in the browser (a 40–150 MB download, slow on older tablets, weak on single words) or on our server (audio uploads and CPU per guess); hosted speech APIs (free only up to a quota).

**Consequences:** A pause longer than 400 ms mid-phrase sends the first half as its own guess ("big purple", then "big purple cactus"); wrong guesses cost nothing, so that's cheap. No mic in Firefox. In Chrome the audio goes to Google, which the privacy page must say. Recognition quality depends on the browser and on the language, and short single words are the hardest case; the server's guess matching already ignores case, punctuation and filler words ("a", "the"), so "It's a cat." still matches.

**Revisit when:** players report poor recognition in a language, Firefox players ask for it, or the privacy story needs audio to stay on the device (Chrome's on-device recognition, or a model in the browser behind the same button).
