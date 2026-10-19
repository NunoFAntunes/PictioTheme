# Status

## Where we are (2026-10-20)

| Phase ([roadmap.md](roadmap.md)) | Status |
|---|---|
| Design and plan | ✅ These docs. Core decisions are in [../README.md](../README.md#decisions-so-far-2026-10-19) |
| 0: Sandbox | **Built, waiting for a playtest.** Tasks 1–5 below are done; task 6 (play it with 3–4 people, tune) is next |
| 1–4 | Not started |

The empty `~/Developer/personal/DoodleTower` folder isn't used: Doodle Tower lives in this monorepo. The work is on the `doodle-tower-sandbox` branch.

### What works today

- **`packages/canvas-engine`**: the stroke model, renderer, painting, flood fill and pointer gate, taken out of `apps/web`. DoodleWhirl imports them from there. Its unit tests pass, and a browser smoke test (drawing on the avatar pad) passes. Its full Playwright suite wasn't run: port 3000 was taken by another local project.
- **`packages/doodle-shape`**: drawing → piece, all 8 steps of [piece-pipeline.md](../technical/piece-pipeline.md), with resolution normalized as well as scale. Pieces follow the drawing closely: up to 64 corners and 16 parts; detached marks (a lightbulb's shine) are joined with rounded webs; when a shape is too complex, notches are filled rather than corners cut. 38 tests on 13 sample drawings, including "the ink is inside the piece" for every sample.
- **`packages/tower-physics`**: one tower's Rapier world (deterministic build 0.21.0). Velocity-steered placing, release on touch or drop, fumbles, height through a chain of contacts, live retuning. 12 tests, including slopes, a ten-brick stack, determinism and performance.
- **Sizes** (2026-10-20): pieces of 1 m², a platform 6 m wide and 0.35 m thick sitting low in the view, lines at 6 / 10 / 15 m, pieces spawning 3.5 m above the tower and lowering at 0.8 m/s. The exact physics and piece values are to be settled over many games, not now.
- **`apps/tower-web`**: its own site on :4322, with the building-site look ([visual-identity.md](../design/visual-identity.md)): Bungee + Space Grotesk, blueprint grid, plywood panels, hazard stripes. `/` is a placeholder; **`/sandbox`** is the Phase 0 tool:
  - Draw a word (real easy cards from the six allowlisted decks) on tracing paper. The piece it would make shows live: solid parts tinted under the ink, dropped ink hatched grey, and a preview card at real size next to a platform ruler.
  - **Build it** queues the piece. The tower view frames the world between a HUD bar (queue, the piece being placed and its timer) and the controls. The piece comes down from the crane over a drop guide: `←/→` (or A/D) move, `Q/E` rotate 15°, `↓` (or S) faster, `Space` drops, and there are on-screen buttons for tablets. You get 15s to place it.
  - Fumbles daze you (5s, +2s per extra, max 10s); a piece already being placed carries on. Topping out: 3s above the line.
  - **Workbench**: queue samples (one, 5 or 20 at random), saved drawings (this browser only), the height line, the daze, and every piece and physics value, live. Debug: collider outlines with centres of mass (green = settled).
  - **Save / JSON**: keep a drawing, or copy it as JSON for a new golden test.
- Repo checks: lint rules (determinism for `doodle-shape` and `tower-physics`, browser globals, React hooks) and import boundaries (`apps-are-separate`, per-package allowlists, tower feature boundaries) are in `eslint.config.js` and `.dependency-cruiser.cjs`.

## How to run and verify

```sh
pnpm dev:tower                                  # http://localhost:4322/sandbox
pnpm check                                      # everything, Doodle Tower included (server tests need pnpm db:up)
pnpm --filter @pictiotheme/tower-web test:e2e   # draws a brick, builds and drops it; stacks four samples
SCREENSHOTS=/some/dir pnpm --filter @pictiotheme/tower-web test:e2e   # …and saves a picture of each stage
```

## Next tasks

1. **Playtest the sandbox** with 3–4 people on PCs and a tablet (Phase 0 "done when" in [roadmap.md](roadmap.md#phase-0-sandbox)). Look at:
   - How many pieces the medium line takes (target 8–12).
   - Whether pieces feel fair, and whether pieces capped by length (long lines) are too weak.
   - Rotation step and lowering speed.
   - Whether the box exploit needs a fix ([open questions](open-questions.md) 2 and 4).
2. Write the tuned values back into [physics.md](../technical/physics.md#tuning-values-to-find-in-the-sandbox) and the defaults (`DEFAULT_TUNING`, `DEFAULT_SHAPE_CONFIG`, `rules.ts`).
3. Paste a few real playtest drawings ("JSON") into `doodle-shape/src/samples.ts` as golden tests.
4. Then Phase 1: `protocol/tower` → `tower-core` → the server `tower` module with the physics worker pool → game screens.

## Known gaps

- Pieces are rendered with their doodle and a paper fill, but sent-by or crew colours don't exist yet (Phase 1).
- The tower view draws the crane and platform simply, with no animation, sound or screen shake (Phase 2).
- The DoodleWhirl Playwright suite needs a run on a machine where port 3000 is free, to confirm the canvas extraction end to end.
