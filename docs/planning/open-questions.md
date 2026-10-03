# Open Questions

Decisions not yet made. Each has a **recommendation** to help get started. Change it if you disagree.

## Product

1. **Where exactly do guesses appear?** The idea says users are on the left with avatar and name, and guesses can be shown or hidden. Do guesses appear (a) as bubbles next to each player in the left list, (b) in a separate chat feed on the right, or (c) both?
   → *Recommendation: both. Bubbles under each player (latest guess, fades out) and a scrolling feed on the right.*

2. **Should a 1-letter typo on a long word count as correct?** (`pumpkn` → correct?)
   → *Recommendation: no, it counts as close (red). That's the standard for the genre, and "close" is part of the fun.*

3. **Are all generated decks public?**
   → *Recommendation: yes by default (it grows the library). Private/unlisted decks are a paid perk later.*

4. **Can guests host public rooms?**
   → *Recommendation: yes (as in the idea), but with stricter rate limits and the profanity filter on room names.*

5. **Themes about real people / brands / copyrighted franchises** ("Harry Potter", "Taylor Swift")?
   → *Recommendation: allow well-known public franchises and public figures as general topics (players love them). Block private individuals. Revisit if there are legal concerns.*

6. **Silly prompts: AI-only, or also template-generated?**
   → *Recommendation: AI-generated silly pool per deck (better quality). Template fallback (`{theme noun} + {random job/activity}`) only for decks that don't have one.*

7. **Should players be able to suggest/edit cards in someone else's deck?**
   → *Recommendation: not in v1. Card flags + remix later.*

8. **Children as an audience?** Family decks suggest kids will play, which raises COPPA/GDPR-K questions.
   → *Recommendation: terms say 13+ (or 16+ in some EU countries) for accounts. Guest play has no data collected. Provide "family-friendly only" as the default filter.*

9. **Team mode** (teams take turns, like classic Pictionary) as well as free-for-all?
   → *Recommendation: free-for-all for v1. Teams in Phase 5.*

## Business

10. **Stripe vs a Merchant of Record (Paddle / Lemon Squeezy)?** With Stripe you handle EU VAT yourself (Stripe Tax helps). A Merchant of Record handles VAT but takes ~5%.
    → *Recommendation: a Merchant of Record for a solo project. Less admin is worth the fee at this scale.*

11. **Free quota size** (3?) and whether it refills monthly (e.g. 1 free per month)?
    → *Recommendation: 3 at signup + 1 per month. It brings people back without costing much.*

12. **Pricing**: are €1.99 / €4.99 / €9.99 packs right? Validate with real AI and payment costs after the first 100 generations.

## Technical

13. ~~Node + WebSocket server vs Cloudflare Durable Objects / PartyKit?~~ **Decided**: Fastify + `ws` in one Node process on the VM. See [decisions.md](../technical/decisions.md) D2.

14. ~~Supabase as an all-in-one?~~ **Decided**: self-hosted PostgreSQL + Better Auth. See [decisions.md](../technical/decisions.md) D1.

15. **Store drawings?** For the end-of-match gallery and replays: only in memory for the room's lifetime, or persisted (cost, privacy)?
    → *Recommendation: memory only. Players can download their own PNG.*

16. ~~Canvas: raw Canvas 2D vs a library?~~ **Decided**: raw Canvas 2D + `perfect-freehand` (see [frontend-guidelines.md](../technical/frontend-guidelines.md#canvas)).

17. **Which model generates decks in production?** Decided by the OpenRouter model eval ([ai-deck-pipeline.md](../technical/ai-deck-pipeline.md#evaluation)). Record the winner in [decisions.md](../technical/decisions.md).
    → *Default until then: Claude Sonnet 5.5.*

18. **What are the VM's specs and egress allowance?** These set the realistic number of concurrent rooms (drawing traffic is bandwidth-bound) and whether Postgres fits comfortably next to the server (≥ 1–2 GB RAM recommended).
