# Roadmap

The order puts the riskiest question first: **is stacking doodles fun, and does it hold up?** Nothing multiplayer gets built until the sandbox says yes.

## Phase 0: Sandbox

A single-player page in `apps/tower-web` (`/sandbox`). No server, no accounts.

- Set up `packages/doodle-shape` and `packages/tower-physics`, and take `packages/canvas-engine` out of `apps/web`, with DoodleWhirl still passing its tests and e2e test.
- Draw a doodle → see the live silhouette → press "Make piece" → place it onto a tower with the real controls → it simulates.
- A debug panel: tuning sliders for the [values in physics.md](../technical/physics.md#tuning-values-to-find-in-the-sandbox), collider outlines on or off, save and load sample drawings (these become the golden tests).
- **Done when**: 3–4 people have played with it, the medium height line takes about 8–12 pieces, and pieces feel different but fair. Also decided: the box exploit fix, and the rotation step.

## Phase 1: Playable match with friends

- Protocol (`protocol/tower`) → `tower-core` state machine (crews, rounds, guessing and steals, decide, queue, placement, fumbles, topping out), with whole-match unit tests → server `tower` module with the physics worker pool → `tower-web` game screens.
- Private rooms with codes, guests, the waiting room, Tower Mix words with easy cards only, results screen.
- A basic visual identity: palette, fonts, logo placeholder (after the design pass in [visual-identity.md](../design/visual-identity.md)).
- Its own domain, in Caddy, deployed.
- **Done when**: a full match of 2 crews × 3 on PCs and tablets plays to topping-out with no desyncs, and a two-browser Playwright test plays a round.

## Phase 2: Feel and polish

Sounds, placing and topping-out animations, award cards, share image of the tower, rematch, reconnects mid-placement, the phone gate, metrics events.

## Phase 3: Shared platform

Picking a single deck, public rooms and a lobby list, accounts when DoodleWhirl's arrive, match history.

## Phase 4: Depth (only after playtests)

Showing the category to unlock more decks, a timed mode, perks for your own crew (glue, a "steady" spell), ink colour as material (blue ice, grey heavy stone), spectators.

The attacking power-ups (curses and spells) were brought forward: they have their own staged plan in [power-ups.md](power-ups.md).
