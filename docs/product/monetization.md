# Monetization

## Principle

**Playing is always free. Generating content, which costs us real money for AI usage, is what we limit.** Ads are deliberately not part of v1: they make a party game worse and bring little revenue at small scale.

## Free quota

| Account state | AI deck generations |
|---|---|
| Guest | 0 (prompted to sign up when they click "Generate") |
| New account | **3 free generations** (one-time grant) |
| Verified email / OAuth | Required before free generations can be used, to discourage farming throwaway accounts |

A "generation" = one full deck (easy + medium + hard + silly pool). Regenerating before publishing (the review screen) is free once per deck.

## Paid credits

Simple prepaid packs, which are easier to build and explain than a subscription:

| Pack | Price (EUR) | Per deck |
|---|---|---|
| 5 decks | €1.99 | €0.40 |
| 15 decks | €4.99 | €0.33 |
| 40 decks | €9.99 | €0.25 |

Credits never expire. Prices are placeholders; validate them against real costs.

### Unit economics (rough)

Estimated AI cost per deck: ~1k input tokens + ~6–8k output tokens (including reasoning). That is **≈ $0.03–0.17 per deck** depending on the model (e.g. Claude Haiku 4.5 ≈ $0.03, Sonnet 5.5 ≈ $0.08, Opus 5.5 ≈ $0.15), plus OpenRouter's fee of around 5% on credit purchases. The production model is chosen by the model eval. Payment processing fees on a €1.99 purchase (~€0.30 + 1.5–2.9%) take a big share of the small pack, which is why the smallest pack is not cheaper. See [../technical/ai-deck-pipeline.md](../technical/ai-deck-pipeline.md#cost) for the breakdown and levers.

Margin: roughly 30–60% after AI and payment costs, which is fine because generated decks keep giving value to the library.

## Possible later options

- **Supporter subscription** (~€2.99/month): N generations/month, a profile badge, extra avatars, unlisted/private decks, custom room themes.
- **Private decks**: keep a generated deck out of the public library (e.g. for an inside-joke family deck).
- **Classroom / team plan**: bigger rooms, a moderation dashboard, no public rooms.
- **Cosmetics**: avatar packs, brush packs, profile frames. These are optional and never affect gameplay.

## Payments implementation

- **Stripe Checkout** (hosted page: handles cards, Apple/Google Pay, SCA, and EU VAT via Stripe Tax). Consider a Merchant of Record (Paddle / Lemon Squeezy) instead if you don't want to deal with VAT registration yourself. See open questions.
- Credits are granted **only from the webhook** (`checkout.session.completed`), with idempotency on the Stripe event ID. The browser's redirect is never trusted.
- `credit_ledger` table (append-only) instead of a mutable balance column, so every grant, use, and refund can be audited. See [../technical/data-model.md](../technical/data-model.md).
- A credit is **reserved** when generation starts and **committed** when it succeeds. If generation fails, it is released automatically, so users never pay for a failed generation.
