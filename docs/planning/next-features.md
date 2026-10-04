# What to Build Next

**Written:** 2026-10-03. This picks up from [status.md](status.md) and reorders the phases in [roadmap.md](roadmap.md) around what we've learned since that roadmap was written. If the two disagree, this file is the newer plan; fold it back into `roadmap.md` once agreed.

Sizes are for one developer working part-time: **S** ≈ a day or less, **M** ≈ 2–4 days, **L** ≈ a week or more.

## Where we are, in one paragraph

The game itself is in good shape: rooms, matches, a solid canvas, guess matching, host controls, reconnects, drawn avatars, and AI deck generation that runs in the app behind a flag. A first quick playtest went well. What's missing is everything _around_ the game: it isn't deployed, there are only two built-in decks, the layout isn't built for touch, and there's no way to see whether a match was fun.

## Decisions taken (2026-10-03)

| Topic | Decision |
|---|---|
| Devices | **Desktop and tablets only.** Phones are too small to draw on, so they get a friendly "open this on a tablet or computer" screen instead of a squeezed layout |
| Guest generation | Guests can generate **1 deck per day** |
| Deck back covers | Every deck has a **drawn back cover**. While a deck generates, its creator is asked to draw the cover |
| Hosting | Decided later. The options are reviewed in [Hosting options](#hosting-options) below |
| Playtest | A quick first playtest went well. A bigger one (~6 people, tablets included) happens on the deployed build before launch |

## Three observations that set the order

1. **Halloween is 4 weeks away.** The roadmap already names a pre-Halloween launch as ideal timing, and the canonical example deck _is_ Halloween. A themed-deck game launching at the most themed time of year is a free marketing moment. Missing it means waiting for Christmas.
2. **AI decks cost ~$0.004, not $0.03–0.17.** The model eval ([model-eval-2026-10.md](../technical/model-eval-2026-10.md)) picked a model 10–40× cheaper than [monetization.md](../product/monetization.md) assumed. With 1 deck per guest per day, even 1,000 guests a day cost about $4. **Accounts, credits and payments are no longer needed to protect our wallet**, only to prevent abuse. So generation, the thing that sets PictioTheme apart, ships to guests at launch, and accounts and payments move later.
3. **The ~1 minute generation wait is dead time, and the back cover fills it.** Drawing the cover turns waiting into the first moment of play, gives every deck a face in the picker and library, and makes a generated deck feel like _yours_. It's also on brand: the game is about drawing.

## The plan

```
 Oct wk 2–4                       Nov                     Dec →
┌──────────────────────────┐   ┌───────────────────┐   ┌──────────────────┐
│ M1 Halloween launch      │ → │ M2 The library    │ → │ M3 Accounts &    │
│ (public, guest-gen,      │   │ loop & retention  │   │ monetization     │
│  covers, tablets)        │   │                   │   │                  │
└──────────────────────────┘   └───────────────────┘   └──────────────────┘
```

---

### M1: Halloween launch (Oct 5–30): public, tablet-friendly, with themed decks that have covers

The goal is to be good enough to post on r/WebGames and in Discord communities in the last week of October. **Theme: "Generate any theme, draw its cover, play in 10 seconds."**

#### Must have

| # | Item | Size | Notes |
|---|---|---|---|
| 1.1 | ✅ **Deck back covers** (done; curated decks keep the default title tile): see [the section below](#deck-back-covers) | L | The new feature for launch. It makes generation feel like play |
| 1.2 | ✅ **Tablet layout and touch** (built and tested in Chrome's iPad emulation: portrait tabs, touch-sized toolbar with 💧 eyedropper, pen pressure, palm rejection, no scroll/zoom while drawing; still to check on a real iPad and Android tablet): the drawer's toolbar works with touch (bottom sheet or side rail, rule W15), Players/Guesses tabs in portrait ([screens.md](../design/screens.md) §4), Apple Pencil/stylus pressure respected, palm rejection (ignore touch while a pen is down), no page scroll or zoom while drawing. Test on iPad Safari and an Android tablet | L | Tablets are the natural device for a drawing game. Right-drag/Alt shortcuts don't exist on touch, so size, opacity and eyedropper need visible touch controls |
| 1.3 | ✅ **Phone gate** (built: touch screen with shorter side < 600 px, `features/phone-gate`, with "Try anyway"): below a minimum viewport (e.g. shorter side < 600 px), show "PictioTheme needs a bigger screen: open this link on a tablet or computer", with a copy-link button. Keep the room link working so the player can switch devices | S | Clearer than a broken layout. Update [screens.md](../design/screens.md) and [frontend-guidelines.md](../technical/frontend-guidelines.md) |
| 1.4 | **Landing page** on `/`: name card + join box ([screens.md](../design/screens.md) §1) | M | "Ten seconds to fun" starts here. Currently there's no real front door |
| 1.5 | ✅ **Seed decks in the DB** (built: 20 curated decks as JSON in `decks/curated/`, seeded by `db:migrate`; hand editing and covers left to the owner): a seed script that moves the built-in decks into `decks`/`cards`, plus **~15–20 curated decks** generated with `deck:generate` and edited by hand, **each with a hand-drawn cover**. Lead with seasonal ones (Halloween, Spooky Movies, Autumn, Day of the Dead) plus evergreens (Animals, Food, Office, 80s/90s, Sports, Fantasy, Space) | M | Two decks isn't a launch. The seed decks' covers set the visual standard for the library |
| 1.6 | ✅ **Guest deck generation, with guardrails** (built with the proposed limits, all in config; the kill switch is `DECK_GENERATION=off`): drop the `DECK_GENERATION` flag. Limits: **1 generation per guest per day**, a per-IP daily limit (e.g. 3, since several guests can share a network), a **global daily spend cap** set in config (with a friendly "generation is busy, try again later" when hit), and a kill switch | M | Our differentiator, available to everyone on day one |
| 1.7 | ✅ **Generation moderation** (built: blocklist on theme, notes, cards, title and tags; reports. Not built: the optional LLM theme check): theme pre-check (a blocklist first, an LLM check if needed), card profanity blocklist (`TODO(moderation)` in `generation/`), and a "report deck" button that hides a deck after N reports. Reports cover the cover drawing too. **Report button built** (3 unique reports hide the cover or the deck); the pre-check and blocklist aren't | M | Required before 1.6 goes public. Generated decks are public by default (open question 3) |
| 1.8 | ✅ **Chat and name profanity masking** (built: chat and guesses masked, names refused) (`TODO(moderation)` in `game-core/src/room/messages.ts`) | S | Public rooms + strangers + launch traffic |
| 1.9 | ✅ **Deck picker v1** (built: cover grid in sections, featured row, title/tag search with `pg_trgm`): a grid of **deck covers** with title, tags, card counts and 🤪, a featured/seasonal row at the top, and a simple title/tag search (`pg_trgm` is enough for now) | M | Once guests generate decks, the picker needs to handle more than two. Covers make it browsable |
| 1.10 | **Deploy** to the chosen host (see [Hosting options](#hosting-options)): `infra/compose.prod.yaml`, Caddyfile, nightly `pg_dump` to R2, a GitHub Actions deploy job, and error monitoring (e.g. GlitchTip or the Sentry free tier) | M | Must land by ~Oct 19 to leave time for the full playtest. The hosting decision can wait until then, but not longer |
| 1.11 | ✅ **Basic product events** (built: `product_events` + card stats, `metrics:report`; see data-model.md#metrics): match started/completed, turns where ≥ 1 player guessed, time from landing to first turn, generations, and covers drawn vs skipped. Stored in a Postgres table, with no third-party analytics | S | The [key metrics](roadmap.md#key-metrics-to-watch) need data from launch day |
| 1.12 | **Full playtest** on the deployed build: ~6 people, laptops and tablets, 3 rounds, one generated deck. Fix what it finds | S + fixes | The Phase 1 exit criterion, now on real hosting and real devices |

#### Should have (cut these first if time runs out)

| # | Item | Size | Notes |
|---|---|---|---|
| 1.13 | **Juice**: score "+180" animation, sounds (turn start, correct guess, timer low), with a mute toggle | M | Makes a game feel finished. Cheap compared to the effect it has |
| 1.14 | **Fill edge ring fix** in `flood-fill.ts` (grow by 1 px, deterministic, with a test) | S | Visible on every fill |
| 1.15 | 🚧 **"🚩 Unfair card" on the reveal overlay + 👍/👎 per deck on results** (built instead: the drawer's 👍/👎 per card while choosing, plus picked/offered counts per card; per-deck votes and the unfair-card flag are still open) (store only; nothing uses them yet) | S | Starts collecting the quality data M2 needs |
| 1.16 | **Share a deck**: a "Play this deck" link with the cover as its social preview image (`og:image`) | S | A drawn cover makes a shared link look like something worth clicking |
| 1.17 | **Load test** (e.g. 50–100 simulated rooms against the deployed host) | S | Know the ceiling before a Reddit spike, especially on free or home hardware |
| 1.18 | **Privacy policy + terms** (a simple page; guest play stores almost nothing) | S | Expected for any public launch, and needed for the 13+ rule (open question 8) |

**Exit:** soft launch to friends by **Oct 20**, public posts on **Oct 27**, with metrics flowing.

---

### Deck back covers

**Status (2026-10-04): done.** Built: the cover pad during generation (skip, done, deck-ready banner, kept across a failed retry), storage and API (decision D7), the default cover, covers in the create-room deck picker, covers in the room (the room's `deck` now carries `coverId`), redrawing a cover later, reporting covers (with deck content reports), and the full drawing toolbar on the cover pad. Still to do, roughly in order:

- [x] Report/hide covers, with deck content reports (part of 1.7): 🚩 in the waiting room and on results, `POST /api/decks/:id/reports`, 3 unique reports hide the cover (default cover shows) or the deck. Reviewing them is the moderator page (2.9)
- [x] Covers on the card-choice screen (the draw pile and the dealt cards' backs), in the waiting room and on results, via `coverId` on the room's `deck` (snapshot and `room:settings`)
- [x] Redraw a cover later: ✏️ on your decks in the create-room picker (`PUT /api/decks/:id/cover`, owner check through `generation_jobs`). Rooms already playing the deck keep the old cover until they load the deck again
- [x] The full drawing toolbar on the cover pad (`DrawingBoard` + `Toolbar` on a local stroke model), with touch-sized targets and a bigger pad on touch screens. The rest of the tablet work is 1.2
- [x] ~~Hand-drawn covers for the seed decks (1.5)~~ Decided 2026-10-04: curated decks keep the default title tile (on the card backs too), so no admin tool is needed. Covers in the library (2.3) and `og:image` (1.16) remain
- [ ] Clean up covers that no deck or job references (2.10)

Every deck has a back cover: a drawing shown wherever the deck appears, like the back of a real card deck.

#### Drawing it while the deck generates

```
┌───────────────────────────────────────────────────────────┐
│  ✨ Generating "Pirates"…  ▓▓▓▓▓▓▓░░░░░  writing medium cards │
├───────────────────────────────────────────────────────────┤
│   Draw the back cover of your deck while you wait          │
│                                                           │
│   ┌───────────────┐   tools: brush · eraser · fill ·      │
│   │               │          colours · undo               │
│   │   (3:4 pad)   │                                        │
│   │               │   [ Skip ]      [ Done ✓ ]             │
│   └───────────────┘                                        │
└───────────────────────────────────────────────────────────┘
```

- When the creator submits the generation form, the progress view turns into a **cover pad** with the progress bar above it. It's prompted, not required: **Skip** is always there.
- Generation and drawing are independent. If the deck finishes first, a banner says "Your deck is ready! Finish your cover, or skip", and the drawing isn't interrupted. If the cover is done first, the pad shows the finished cover with the progress bar still running.
- If the creator skips, closes the tab, or generation fails, nothing is lost. A skipped deck gets a **default cover** (the deck title on a pattern coloured from a hash of the theme). On failure, the drawing is kept in the browser so it can be reused on the retry.
- The creator can **redraw the cover later** (✏️ on their decks in the deck picker) for as long as they're the owner (same guest identity, or the account once accounts exist).

#### How it fits the existing code

- **Canvas:** the cover pad is the game's `DrawingBoard` and `Toolbar` on its own local stroke model at 600×800, and exports a 300×400 PNG. The avatar pad (`features/canvas/SketchPad`) keeps its reduced toolbar.
- **Storage:** a `deck_covers` table using the same content-addressed PNG pattern as avatars, with nullable `cover_id` columns on `decks` and `generation_jobs` ([decisions.md](../technical/decisions.md) D7).
- **API:** the cover is attached to the **generation job**, so it can be uploaded before the deck exists: `PUT /api/decks/generations/:id/cover`, owner only, rate-limited, size-checked like avatars. The job copies it to the deck when it completes, or when the cover arrives after completion. Covers are served by `GET /api/decks/covers/:id` (immutable, long cache). `PUT /api/decks/:id/cover` redraws a published deck's cover; the owner is whoever's generation job made the deck, and anyone else gets a 404.
- **Where it shows:** deck picker and library tiles, the waiting room's deck summary, the **card-choice screen** (the drawer's 3 cards shown face down with the deck's back, then flipped, which is a nice moment to animate), the results screen, and `og:image` for shared deck links.
- **Moderation (built):** covers are user drawings shown to strangers. 🚩 on the deck reports its cover or its content; 3 reports from different players about the current cover hide it, and it falls back to the default cover rather than hiding the deck.
- **Seed decks:** they keep the default title tile as their cover (decided 2026-10-04), so the library launches with title tiles for curated decks and drawn covers for generated ones.
- **Tests:** server e2e for upload before and after job completion, ownership, and size limits. A Playwright spec extending `generate-deck`: draw a cover during generation, then see it in the picker.

**Docs to update when building it:** [decks.md](../product/decks.md) (what a deck is), [user-flows.md](../product/user-flows.md) and [screens.md](../design/screens.md) (generation flow, picker), [data-model.md](../technical/data-model.md), and [ai-deck-pipeline.md](../technical/ai-deck-pipeline.md) (the job lifecycle).

---

### M2: The library loop and retention (November): make decks get better, and make people come back

Launch traffic will show what people actually do. This milestone is about the growth engine from [vision.md](../product/vision.md): _search → not found → generate → it's in the library for everyone._

| # | Item | Size | Notes |
|---|---|---|---|
| 2.1 | **Match history**: `matches`/`match_players` tables, written from the `matchEnded` effect that's currently only logged (`rooms.service.ts`) | M | The base for card stats, deck play counts and profiles |
| 2.2 | **Card stats + deck quality score**: guess rate per card (demote ~0% cards), plays per deck, 👍 %, report rate | M | Uses the data from 1.15 and 2.1 |
| 2.3 | **Full library search and browse**: `tsvector` over title/tags/card text, ranked by relevance × quality; a cover-led library page and a deck preview page | M | Also good for SEO ("halloween pictionary words") |
| 2.4 | **"Similar decks exist" before generating** ("There are 12 Halloween decks already. Generate anyway?"), shown with their covers | S | Keeps the library from filling with duplicates, and saves the guest's one daily generation |
| 2.5 | **Review step after generation**: remove cards, one free regenerate ([ai-deck-pipeline.md](../technical/ai-deck-pipeline.md)). It sits naturally after the cover pad | M | Better decks in the library |
| 2.6 | **End-of-match gallery**: every drawing from the match shown on the results screen, each downloadable as PNG (kept in memory only, open question 15) | M | The most screenshotted moment in drawing games, and organic marketing |
| 2.7 | **Deck remix: "add more cards"** to an existing deck | M | The library grows in depth, not only breadth |
| 2.8 | **Generation jobs on pg-boss** + streaming progress (SSE) instead of polling | M | Survives restarts |
| 2.9 | **Moderation admin page**: reported decks, covers and avatars; hide/restore; ban | M | By now there will be reports to review |
| 2.10 | **Cleanup job for unused guest images** (avatars and orphaned covers, unused ~30 days) | S | Housekeeping before the tables get big |

**Exit:** a returning player can find a better deck than last week, and deck quality metrics trend up.

---

### M3: Accounts and monetization (December onwards): only once there's demand to monetize

With generation this cheap, accounts are about **identity and keeping things**, and payments are about **sustainability at scale**, not about covering each generation.

| # | Item | Size | Notes |
|---|---|---|---|
| 3.1 | **Accounts with Better Auth** (magic link, Google, Discord) as a second `Actor` kind ([actor.ts](../../apps/server/src/lib/actor.ts)); guest → account upgrade keeps your decks and covers | L | |
| 3.2 | **Saved avatars** (`user_avatars` gallery) and a "my decks" shelf showing your covers | M | The first real reason to sign up |
| 3.3 | **Profiles and stats**: matches played, decks created and their play counts | M | Built on 2.1 |
| 3.4 | **Rethink the free tier**: e.g. guests 1/day (as now), accounts more per day, and paying gets private/unlisted decks, bigger decks and priority. Update [monetization.md](../product/monetization.md) | S | Credits per generation may be the wrong model at $0.004. **Sell perks, not generations** |
| 3.5 | **Payments** via a Merchant of Record (open question 10) + ledger + webhooks | L | Only if 3.4 still needs it. A one-off "supporter" purchase may be enough at first |

---

### Later (ideas pool, unordered)

Revisit once there's data from M1–M2.

- **Drawing tools v1.1**: shapes, pressure brush types, long-press eyedropper on touch ([drawing-tools.md](../product/drawing-tools.md)).
- **Undo checkpoints** in `renderer.ts`. Likely needed sooner on older tablets; watch for it in the playtest.
- **Phone guess-only mode**: let phones join as guessers who never draw. Only if the phone gate turns away many players at parties.
- **Animated cover reveal**: the card-choice flip, and a deck "box" on the results screen.
- **Streamer mode**: hide the room code and guesses, add a delay.
- **Classroom / team mode** (open question 9): teams taking turns, teacher-only controls, family-safe decks only. Tablets make classrooms a natural fit.
- **More languages** (PT, ES, FR) with language-aware guess matching.
- **Semantic close guesses** (embeddings), e.g. "pumpkin" vs "jack-o'-lantern".
- **Replays / shareable GIF** of a drawing being made.
- **Seasonal events**: a featured theme of the week, holiday deck packs (Christmas is next after Halloween).
- **Cosmetics**: avatar frames, brush packs, cover frames. Never pay-to-win.

## Not doing (yet), and why

| Idea | Why not now |
|---|---|
| Phone layouts | Decided: phones are too small to draw on. A phone gate is cheaper and clearer |
| Accounts before launch | Costs a week or more, and guests can already do everything that matters. Signup friction hurts "ten seconds to fun" |
| Credits/payments before launch | At $0.004/deck and 1 per guest per day, a spend cap protects us more cheaply than billing does |
| AI-generated cover images | Costs more, needs image moderation, and is less fun than drawing your own. The drawn cover is the point |
| ~30 curated decks (the old Phase 2 goal) | ~15–20 good ones with real covers, plus guest generation, is a better launch than 30 rushed ones |
| Persisting match drawings | Privacy and storage cost for little gain. PNG download covers it (open question 15). Covers are different: they're opt-in and public by design |

## Hosting options

To be decided later. Both options can run the planned Docker Compose stack (Caddy + server + Postgres). This answers open question 18.

| | **Oracle Cloud Always Free** (Ampere A1) | **Home Proxmox box** (i7-4790K, 16 GB) |
|---|---|---|
| Capacity | Up to 4 ARM cores / 24 GB RAM free, which is plenty | 4 cores / 8 threads, 16 GB, also plenty for launch |
| Bandwidth | 10 TB/month egress included, datacenter network | Limited by your home upload speed, which matters most: drawing traffic fans out to every guesser |
| Reachability | Public IP, behind the Cloudflare proxy as planned | **Cloudflare Tunnel** (supports WebSockets): no open ports, no static IP needed |
| Reliability | Datacenter power and network | Home power, ISP outages, and your own maintenance |
| Gotchas | **ARM64**: images must be multi-arch (official Node and Postgres images are). Oracle **reclaims idle Always Free instances**; upgrading the account to Pay As You Go avoids that and stays free within limits. A1 capacity can be "out of stock" in popular regions, so retrying or picking another region may be needed | Shares hardware and network with your home; keep backups off the box (R2, as planned) |

**Recommendation:** Oracle for production (upgrade to Pay As You Go to avoid reclamation), and the Proxmox box as a **staging environment** and second backup target. If Oracle capacity or reclamation becomes a problem, the home box with a Cloudflare Tunnel is a good fallback, because the stack is the same Compose file.

## Decisions still needed

1. **Hosting** (above), by ~Oct 15 to keep 1.10 on track.
2. ~~**Per-IP generation limit and global daily spend cap.**~~ Built with the proposed 3 per IP per day and $5/day; change them in config (`GENERATION_PER_IP_PER_DAY`, `GENERATION_DAILY_BUDGET_USD`).
3. **Launch dates.** Proposed: soft launch to friends Oct 20, public posts Oct 27.
4. **Decks public by default?** (open question 3). This plan assumes yes, covers included, with report-to-hide.

## What to measure at launch

| Metric | Healthy looks like |
|---|---|
| Time from landing to first turn | < 30 s for a link joiner |
| Matches completed / started | > 60% |
| Turns where ≥ 1 player guessed | > 70% (lower → deck/card quality problem) |
| % of generations where a cover was drawn (not skipped) | > 50% means the wait-time drawing works |
| % of matches played on a generated deck | The bet behind the product. If it's low, the library and picker need work |
| Generations per day vs the global cap | Never hitting the cap at launch, or raise it |
| Visitors turned away by the phone gate | If high, consider phone guess-only mode |
| Tablet share of players, tablet match completion rate | Tells us if 1.2 was enough |
