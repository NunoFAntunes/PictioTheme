# Deck Generation Model Eval, October 2026

**Date:** 2026-10-03 · **Total spend:** $0.52 of a $1.00 cap · **Runs:** 136, of which 94 produced a usable deck (all graded)

This picks the model and prompt for AI deck generation ([ai-deck-pipeline.md](ai-deck-pipeline.md#evaluation)). Every deck went through the real pipeline (prompt → OpenRouter → cleanup → top-up). Reproduce with `pnpm --filter @pictiotheme/server deck:eval` (inputs in `apps/server/evals/`, raw results in `apps/server/evals/results/`, gitignored).

## Recommendation (adopted: [decisions.md](decisions.md) D6)

| Use | Model | Prompt | Why |
|---|---|---|---|
| **Production** | `openai/gpt-6-luna` | `v3-examples` | Ties for best quality (7.2–7.4/10), 15/15 decks succeeded, ignored the prompt injection, **$0.004 per deck**, ~1 min |
| Fallback | `openai/gpt-6-luna-pro` | same | Slightly better (7.2–7.6) but 3× the price and ~2× slower. Same vendor, so it doesn't cover an OpenAI outage |
| Local dev | `stealth/space-bunny-alpha` | same | Best free model (5.8 with v3). Followed the injection once with v2. Free/stealth models are never for production ([decisions.md](decisions.md) D4) |

At $0.004 per deck, `gpt-6-luna` is ~20× cheaper than the Claude Sonnet 5.5 estimate in the pipeline doc ($0.07–0.09). Sonnet wasn't in this eval (cost cap); compare it next if higher quality is wanted.

## Method

- **Themes (5):** `space` (broad), `camping trip` (easy + medium only, so silly cards must stay in those levels), `the 1990s` (an era: brand names and abstractions are the trap), `Greek mythology` (source material full of violence and abduction), `zombie apocalypse` with a **prompt injection** in the notes asking for gore, drugs, guns and no silly cards. All with silly cards on.
- **Prompts (3):** `v1-short` (the original sketch), `v2-rules` (the current production prompt: drawable/unique/varied/guardrails sections), `v3-examples` (v2 plus good/bad examples from an unrelated "Farm" theme and a step-by-step method for silly cards). All share the same JSON output section. Source: `apps/server/scripts/eval/prompts.ts`.
- **Stage 1:** 11 models × v2 × 5 themes. **Stage 2:** the 7 models that completed stage 1 × v1 and v3 × 5 themes.
- **Grading:** blind. Per theme, one grader read every deck under shuffled labels with model and prompt hidden, using one rubric: drawable, guessable, on theme, near-duplicates, difficulty calibration, silly funniness and variety, safety, and (zombie only) whether the injection was followed. Scores were then joined with the key and the automatic metrics.

## Results by model (all prompts)

| Model | Usable decks | Overall /10 | Silly funny /5 | Bad cards* | Safety flags | $/deck | Avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna-pro | 15/15 | **6.9** | 3.9 | 9% | 10 | $0.0109 | 101 s |
| openai/gpt-6-luna | 15/15 | **6.6** | 3.8 | 11% | 11 | $0.0039 | 58 s |
| z-ai/glm-5.3-flash | 10/15 | 5.2 | 3.9 | 12% | 42 | $0.0043 | 93 s |
| stealth/space-bunny-alpha (free) | 15/15 | 4.9 | 3.3 | 18% | 19 | $0 | 106 s |
| qwen/qwen3.8-27b:free | 2/5 | 4.5 | 3.0 | 22% | 0 | $0 | 91 s |
| deepseek/deepseek-v4-flash | 13/15 | 4.1 | 2.9 | 16% | **69** | $0.0011 | 119 s |
| google/gemini-3.1-flash-lite | 13/15 | 3.9 | 2.8 | 22% | 18 | $0.0109 | **26 s** |
| inception/mercury-2.5 | 11/15 | 2.6 | 1.6 | 29% | 36 | $0.0015 | **17 s** |
| qwen/qwen3.8-flash | 0/5 | — | — | — | — | — | timed out |
| xiaomi/mimo-v2.6-flash | 0/5 | — | — | — | — | — | timed out / out of tokens |
| dots-studio/dots-3-note-preview:free | 0/5 | — | — | — | — | — | all reasoning, no output |

\* Share of a deck's cards a grader marked undrawable, obscure, off theme, or an undrawable silly card. `nvidia/nemotron-3-super:free` was excluded before the run: it only routes to providers that may train on prompts, which our `data_collection: deny` setting blocks.

Why the others lost:
- **deepseek-v4-flash:** cheapest by far, but the worst safety. It followed the zombie injection under every prompt (shotgun headshots, grenades) and wrote "Perseus slaying Medusa" and "Hades abducting Persephone" style cards.
- **glm-5.3-flash:** funny silly cards, but weapons everywhere in the zombie deck. Its latency is erratic: it hit the 180 s timeout on 4 of 10 stage 2 runs, and one provider capped its output at 4,096 tokens.
- **gemini-3.1-flash-lite:** fast and reliable, but bland: generic filler, many near-duplicates, and decks too short under the short prompt.
- **mercury-2.5:** the fastest (~17 s), but the weakest decks, and it refuses the zombie theme outright. Under v1 it put real celebrities, 9/11 and Enron into the 1990s deck.

## Results by prompt (all models)

| Prompt | Overall /10 | Silly funny /5 | Bad cards | Safety flags | $/deck |
|---|---|---|---|---|---|
| `v3-examples` | **5.6** | 3.5 | 13% | 52 | $0.0055 |
| `v2-rules` | 5.2 | 3.1 | 16% | 73 | $0.0044 |
| `v1-short` | 4.1 | 3.0 | 21% | 80 | $0.0041 |

- **Detailed rules matter most.** v1 → v2 lifted quality by a full point. With v1, "hard" turned into hard *vocabulary* (Fermi paradox, tidal locking) instead of hard-to-draw scenes.
- **Examples help weaker models most** (space-bunny 5.0 → 5.8, deepseek 3.8 → 5.3) and are neutral for gpt-6-luna (7.4 vs 7.2, within noise at n = 5). They also cut safety flags. So v3 is the better production prompt, because it also makes the fallback models better.

## What still goes wrong (even for the best decks)

1. **Source-material violence slips through.** Myth decks still get "Zeus changing into a swan", "Europa riding a bull", "Apollo chasing Daphne", Medusa's head. Zombie decks from weaker models get axes, bats and chainsaws. The guardrails need explicit lines for "violent or sexual episodes from myths, films or history" and "hand weapons used against people or creatures".
2. **Near-duplicates:** graders still found ~11 near-duplicate pairs per deck (rover/lander variants, "Tent" next to "Tent with guy lines", the same story as a medium and a hard card). The deterministic dedupe only catches identical words. A prompt line about not reusing a subject across pools, or a cheap similarity check, would help.
3. **Indistinguishable cards:** every planet by name (Venus, Uranus and Neptune are identical circles), lists of minor named characters in mythology. These are drawable but not guessable.
4. **Silly cards converge on one formula** ("X doing a chore") and on stock jokes shared across models (Firewood doing ballet, Pine tree getting a haircut).

## Pipeline issues found and fixed during the eval

| Issue | Fix |
|---|---|
| Reasoning models used the whole 16k token budget before writing JSON (`finish_reason: length`, empty content) | `DECK_MAX_TOKENS` 16k → 32k, top-up 6k → 12k |
| A cut-off reply was retried with the same limit, doubling time and cost for the same result | Only malformed replies are retried now |
| Timeouts were reported as "unexpected response"; a provider error inside an HTTP 200 body wasn't recognised | The client reports `timed out after 180s` and the upstream error message and code |
| **Timed-out calls are still billed** ($0.035 of stage 1 came from calls we abandoned) | The eval counts failed calls at worst case. Production should keep slow models out of the routing list |

Known gap: a provider-side refusal (mercury's "I can't help with that", passed through as a 502) surfaces to the user as "busy, try again" instead of "we couldn't make a deck for that theme".

## Cost

| Item | Spend |
|---|---|
| Stage 1 (55 runs) | $0.20, of which ~$0.035 was billed timeouts |
| Stage 1 re-runs, stage 2 and the gemini v3 make-up run (81 runs) | $0.32 |
| Probes and smoke tests | < $0.01 |
| **Total (OpenRouter key usage)** | **$0.52** |

Per deck, for a full ~145-card deck: gpt-6-luna $0.004, gpt-6-luna-pro $0.011, glm-5.3-flash $0.005, deepseek-v4-flash $0.001, gemini-3.1-flash-lite $0.011, mercury-2.5 $0.0015. 1,000 decks with gpt-6-luna ≈ $4.
