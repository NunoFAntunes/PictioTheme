# Power-ups: Curses and Spells

The plan for making the two crews mess with each other, in the spirit of Tricky Towers' dark magic. Decided 2026-10-20. It brings forward the power-ups from [Phase 4](roadmap.md#phase-4-depth-only-after-playtests) and only keeps the attacks: perks for your own crew (glue, steady…) wait until these have been played.

## The rules in short

### 1. Send becomes Curse

**Send is removed.** The decider's two choices are now:

- 🧱 **Keep**: as today, the piece joins your queue and you place it.
- 🌀 **Curse**: the piece gets a **random curse** and goes to the other crew, who must place it. It's still tagged "cursed by Orange".

The curse is rolled when the piece is made and **shown on the decide card** ("🌀 Curse: 🧊 Slippery"), so the 5s choice is an informed one. The timeout is still Keep.

A curse belongs to the piece. It changes how the piece behaves or how it's placed:

| Curse | Effect | Stage |
|---|---|---|
| 🧊 **Slippery** | Friction 0.05 (the existing "ice" value) | 1 |
| ~~⏱ **Short fuse**~~ | ~~7s to place instead of 15, and it lowers twice as fast~~. **Removed 2026-10-21** until it's reworked (see below) | 1 |
| 🧊🎈 **Big ice** | Bloat (×1.4 area) **plus** Slippery. Bloat never comes alone: on its own, a bigger piece just makes the victim's tower taller | 1 |
| 🫠 **Melt** | Corners rounded off, flat edges sag: a brick becomes a pebble | 3 |
| 🏀 **Bouncy** | Restitution 0.6 for the first 3s after it's released, then normal. Only the 3s keep it from being overpowered | 3 |
| 🫠🎈 **Blob** | Bloat plus Melt | 3 |

A golden piece that's cursed gets **two** curses that don't clash (never two shape curses, or two friction ones).

### 2. Spells

Spells aren't tied to a piece. A crew holds them and casts them at the other crew.

- **Inventory**: at most **2** spells per crew. Each spell is rolled when it's earned, so the crew knows what it holds and can plan. Both crews see both inventories: that's half the tension.
- **Casting**: any crew member who isn't drawing (a placer can cast too) presses the spell's button or `1` / `2`. The first press wins.
- **Warning**: a cast shows a 2s warning over the target tower ("🌫 Teal is casting Fog!"), then the spell starts.
- **One at a time**: a tower can only be under one spell at a time. While one is running, the other crew's cast buttons are greyed out ("their tower is already cursed").

| Spell | Effect | Lasts | Stage |
|---|---|---|---|
| 🌫 **Fog** | A cloud covers the top of their tower, where pieces are placed: the placer sees only the guide line and the piece | 10s | 1 |
| 🐦‍⬛ **Magpie** | Steals the next piece in their queue (not the one being placed) into yours, and the caster places it. If their queue is empty, the magpie circles until the next piece comes, for up to 30s | until it takes one | 1 |
| 〰 **Shaky hand** | Their drawer's strokes wobble | 10s | 2 |
| 🐦 **Pigeon** | A pigeon lands on one edge of their top piece: a small weight that tips the balance. The next piece that touches it scares it away (or it leaves after 25s) | until scared | 4 |

### 3. Earning spells

| Source | Rule | Stage |
|---|---|---|
| ✨ **Golden words** | About 1 in 6 rounds deals a golden word. Both crews see the gold card (not the word). Whoever solves it gets the piece **and** a spell for their crew, so stealing a golden word is worth double | 1 |
| 🆘 **Comeback** | A crew gets a spell when a piece falls off its tower (with the daze on or off), or when its tower is 2+ units behind the other one for 20s straight. At most one every 90s | 1 |
| ⭐ **Sky stars** | A star floats just past the edge of each tower's platform. A settled piece, connected to the tower, that touches the star for 3s captures it. One star per tower, at the same place and time for both towers (fair), every ~90s; it disappears after 45s if nobody captures it | 2 |

Curses need no earning: every piece can be cursed instead of kept.

### 4. The host setting

`powers` in the waiting room ("Curses & spells"): **on** (default) or **off**. With powers off, Curse sends the piece with no curse (today's Send), and no golden words, comeback spells or stars appear.

## How it fits the code

| Part | What changes |
|---|---|
| `packages/protocol/src/tower` | `PieceChoice` becomes `'keep' \| 'curse'`; `Curse` and `Spell` enums; `curses` on `PieceShape`/piece views; `powers` in `TowerSettings`; new messages (below) |
| `packages/tower-core` | Curse rolls and spell rolls through the seeded `ctx.rng` (no `Math.random`); crew `charges`, `activeSpell`, golden rounds, comeback tracking, stars; new timers (`spell:<team>`, `comeback:<team>`, `star:<team>`, `magpie:<team>`) |
| `packages/doodle-shape` | `bloat(piece, factor)` and (stage 3) `melt(piece)`: pure transforms of a made piece, so the outline, parts and silhouette stay in step |
| `packages/tower-physics` | Per-piece material on `spawn` (`friction`, `restitution`, `bouncyForMs`); placement speed per piece; (stage 2) star sensors; (stage 4) a pigeon body that doesn't count toward height or fumbles |
| `apps/server/.../physics` | The worker passes the new ops through and reports `starTouch` |
| `apps/tower-web` | The decide card (Keep / Curse with the rolled curse), curse looks on pieces (a frost tint, a fuse spark, a melted outline), the inventory and cast buttons, warning banners, fog, the gold card, stars and the pigeon sprite; sandbox controls to apply any curse to a piece |
| Docs | [game-rules.md](../product/game-rules.md), [realtime-protocol.md](../technical/realtime-protocol.md), [physics.md](../technical/physics.md), [piece-pipeline.md](../technical/piece-pipeline.md), [screens.md](../design/screens.md) |

New messages (C → S): `spell:cast {slot}`.
New messages (S → C, to everyone): `crew:charges {team, charges}`, `spell:warn {team, spell, by, startsAt}`, `spell:start {team, spell, endsAt}`, `spell:end {team}`, and, from stage 2, `star:spawn {tower, x, y, until}`, `star:hold {tower, until}` and `star:captured {tower, spell}`. `round:start` gets `golden: boolean`. `piece:made` carries the rolled curse(s), `piece:queued` carries `cursed`.

Privacy doesn't change: a golden round shows the gold card to both crews, never the word. Spells, curses and inventories are public.

The `sends` stat becomes `curses` in the protocol. The database column keeps its name (no migration needed). The "Meanest send" award becomes "Meanest curse".

## Stages

Each stage ends with something playable, tested (`pnpm check`, plus the tower e2e test) and playtested before the next one starts. The order inside a stage follows the repo rule: protocol → `tower-core` → server → web → docs.

### Stage 1: The whole loop, with the easy powers

Everything from "solve" to "cast", with the five easiest powers. After this stage the game plays the way it will play from then on; later stages only add content.

**1a. Curse replaces Send** ✅ built 2026-10-21

The keys are K (Keep) and C (Curse). What each curse does lives in one place, `CURSE_TUNING` and `curseEffects()` in `packages/protocol/src/tower`, so the server and the sandbox share it.

1. Protocol: `'keep' | 'curse'`, the `Curse` enum (`slippery`, `short_fuse`, `big_ice`), curses on pieces, the `powers` setting.
2. `tower-core`: roll the curse when the piece is made; `decide` sends a cursed piece; a Short fuse piece gets the shorter placement timer. Tests: the roll is seeded and repeatable, the timeout keeps the piece, a cursed piece reaches the other queue with its curse, powers off means no curse.
3. `doodle-shape`: `bloat()`, with tests (area ×1.4, outline and parts still match, fidelity to the strokes kept).
4. `tower-physics`: material and lowering speed per piece on `spawn`. Tests: a slippery box slides off a 15° slope that holds a normal one; a short-fuse piece lowers at its own speed.
5. Web: the decide card, curse looks on pieces in the queue and on the tower, the "cursed by" banner, the award rename. Sandbox: a curse picker for the next piece.

*Checkpoint*: play a match with curses only. Is Curse picked about as often as Send used to be? Is it too strong now that every send hurts?

**1b. Spells, golden words, comeback** ✅ built 2026-10-21

The numbers are `SPELL_TUNING` in `packages/protocol/src/tower`. Earning lives in `tower-core/src/spells.ts`; casting and Magpie in `match.ts` (they need the queue). Every piece queued for a tower goes past `magpieSnatch` first. The magpie is the pigeon's drawing in black and white with a long tail (`tower-web/src/app/features/tower/birds.ts`): it flies in from the caster's tower and circles over the target's top; when it takes a piece it flies back out carrying it, then flies it into the thief's tower and lets go over the balloons (the piece isn't drawn until then); if it gives up, it flies off empty. The sandbox's "🐦‍⬛ Send a magpie" sends one to circle its tower: it takes the next piece to come up and, with no other tower, brings it straight back. Sounds: both birds' wings as they fly in, then the magpie's caws or the pigeon's coo once it's landed; a caw, a ting and wings when a magpie takes a piece; a grumpy caw and wings when it gives up (`magpie-off`). The sandbox has a "Fog over the tower" switch to judge the fog's look. A crew that's full when it earns a spell doesn't get one.

1. Protocol: `Spell` (`fog`, `magpie`), `spell:cast`, the charge and spell messages, `golden` on `round:start`.
2. `tower-core`: inventory (cap 2), casting rules (not the drawer, one spell per tower, the 2s warning), golden rounds (seeded, about 1 in 6, never twice in a row for a crew), the two comeback triggers with their 90s cooldown, Magpie's queue move and its 30s wait. Tests for each, plus a whole-match test where both crews cast.
3. Server: the new timers through the runtime. Fog and Magpie need nothing from physics.
4. Web: the inventory and cast buttons (`1` / `2`), warning and start banners, the fog cloud over the tower (dense for the victim's crew, see-through for the caster's), the gold card in the drawing frame and in the sky.

*Done when*: a 2 × 3 match uses every power at least once; nobody feels a spell decided the match; matches still take roughly the same time per line.

### Stage 2: Sky stars and Shaky hand ✅ built 2026-10-21

As built: the star is a ball sensor on the platform's body (`setStar` / `clearStar` / `starHeld` in `tower-physics`); pieces pass through it, and only a settled piece standing on the tower (the height's own chain) holds it. The worker sends `starHeld` with every height report; `tower-core/src/stars.ts` does the rest. Shaky hand's wobble is `shakePoints(pts, strokeId, firstIndex)` in the protocol (pure, no randomness), so the drawer's client (`draw-sender.ts`) and the server agree; a stroke wobbles if it was begun while the spell ran. The numbers are `STAR_TUNING` and `SPELL_TUNING.shakyMs`. The sandbox has "⭐ A sky star to catch", which comes back on the other side each time it's caught.

1. `tower-physics`: a star is a sensor collider. The worker reports which settled pieces, connected to the platform, are touching it (the same check the height uses).
2. `tower-core`: where stars appear (seeded, the same for both towers, reachable only with an overhang past the platform edge, 1–3 units above the current top), the 3s hold, the 45s expiry, the capture. Tests: a piece resting on the star captures it; one that slides through doesn't; a falling piece doesn't count.
3. Shaky hand: a pure, seeded `jitter(point, roundId, index)` in `tower-core`. The server applies it to the drawer's points while the spell runs (so the shape and everyone's view use the wobbly strokes), and the drawer's own client applies the same function, so what they see matches.
4. Web: the star (a gentle bob, a ring that fills during the hold), Shaky hand's wobble warning on the drawer's canvas.

*Checkpoint*: are stars worth chasing, or too risky? Tune their height, distance from the edge and timing. Is Shaky hand funny or just annoying for drawers?

### Stage 3: Melt, Bouncy and combos ✅ built 2026-10-21

As built: Melt is a pipeline option (`makePiece(…, { melt: true })`, `doodle-shape/src/melt.ts`). After the main blob is picked, each column of cells slides down along a parabola over the piece's width (the middle droops 35% of its height), then an opening rounds the corners. The top dips and the bottom bulges, so it rocks. The sag function travels with the shape (`melt: {cx, halfWidth, sag}`), and the client warps the doodle's bitmap with it, column by column, so the ink droops too. Bouncy is restitution 0.6 with Rapier's `Max` rule, from spawn until 3s after release. Blob is Bloat plus Melt. A golden piece rolls two curses, never two of the same kind (`cursesClash`: shape, friction, bounce, fuse).

1. `doodle-shape`: `melt()`, an opening (erode, then dilate) on the piece's grid, then retrace, simplify and normalise, reusing the pipeline's steps. Tests: corners round off; a brick no longer stacks flat; same input, same result.
2. `tower-physics`: Bouncy's timed restitution. Balance it in the sandbox first (the value and the 3s window). Drop it if it can't be made fair.
3. `tower-core`: Blob, and double curses on golden pieces (a weighted roll that never pairs two shape curses).
4. Web: the melted outline (drips), the bounce effect, two curse badges on a piece.

### Stage 4: Pigeon ✅ built 2026-10-21

As built: the pigeon is a ball body (0.18 m, 0.4 kg, about a third of a piece, friction 1.5, rotation locked so it grips instead of rolling), kept out of the world's pieces: it never counts for the height or fumbles. `landPigeon(side)` puts it on the highest point of the outer quarter of the tower's top piece (or the platform's edge). Only a piece released after it landed, or the one being placed, scares it away; the piece it's perched on doesn't. It goes out in frames as body `PIGEON_ID` (−1), and the worker reports `pigeonGone` when it's scared or falls; otherwise it leaves after 25s. Clients draw it (a vector pigeon, head bobbing) only while the spell runs: it flies in to its perch from its side, and up and away when it ends. No coo yet (stage 5). The sandbox has a "🐦 Land a pigeon" button.

1. `tower-physics`: a light creature body (it doesn't count toward height and doesn't fumble or daze; if it falls it just flies off). Placed on the top piece's outer edge. Scared away by the next piece's contact, or after 25s.
2. `tower-core` and server: the spell, its timer, and frames for the pigeon (its own id range).
3. Web: the pigeon sprite (it fits the village's creatures), landing and flying-off animations, a coo.

### Stage 5: Tuning and polish

**Sounds** ✅ built 2026-10-21: every power has its synthesised sound ([visual-identity.md](../design/visual-identity.md#game-sounds)), picked by `room-cues.ts`. Spells sound as they start (after the warning), from the room sound hook's timer (`startedSpells`). The sandbox plays the curse, fog, star and pigeon sounds too.

Sounds for every curse and spell, curse and spell awards on the results ("Best star catch", "Dirtiest magpie"), the curse and spell weights, golden-word frequency, comeback thresholds, and the spells' durations, all from playtest notes. Then decide whether perks for your own crew (glue, steady) are wanted.

## To decide while playtesting

- Is the curse better **shown on the decide card** (current plan) or a surprise after choosing?
- Should a crew also see **the other crew's inventory** (current plan: yes)?
- With Send gone, do crews still have enough reasons to send? If Curse turns out too strong, make some rolls duds ("🍀 Lucky: no curse").
- Can a cursed piece be stolen back with Magpie? (Current plan: yes, curse and all.)
- **Short fuse needs rethinking** (playtest, 2026-10-21; **removed from the game** the same day, until then): cursing a piece gives the other crew a free block, and a short fuse barely hurts, so it's a gift. The physics still supports a piece's own lowering speed (`PieceMaterial.lowerScale`) if a reworked fuse wants it. Ideas: a fuse that *explodes* (the piece pushes its neighbours when the time runs out), a fuse that's only worth it combined with another curse, or dropping it. To refactor later.
