# Physics

## Engine: Rapier 2D (deterministic build)

| Option | Verdict |
|---|---|
| **Rapier 2D** (WASM, `@dimforge/rapier2d-deterministic-compat`) | ✅ Stacks tall towers stably, fast, deterministic across platforms, world snapshots for reconnects and tests, compound colliders |
| Matter.js | ❌ Tall stacks jitter and slowly creep apart. Fatal for a tower game |
| Planck.js (Box2D port) | Good at stacking, but slower and its determinism isn't guaranteed |
| Box2D v3 (WASM) | Excellent, but the JS bindings are young. Fallback if Rapier disappoints |

## Who simulates: the server

Each room has two worlds, one per tower. They run in a server worker thread ([architecture.md](architecture.md#server-the-tower-module)) at 60 Hz. The server is the only one that decides heights, fumbles and the winner.

- **Frames**: at 20 Hz the server sends each tower's **awake** bodies as quantised `[id, x, y, angle]` (x and y in centimetres, angle in 1/1000 rad). Sleeping bodies aren't sent. A settled tower costs nothing. Clients draw about 100 ms in the past and interpolate between the two frames around that time.
- **Bandwidth**: about 20 moving bodies × 4 numbers × 20 Hz is a few KB/s per player at peak. That's the same scale as the drawing traffic.
- **The piece being placed** is a normal dynamic body with gravity off, **steered by velocity**: every step its velocity is set towards the placer's target x and angle, and it lowers at a fixed speed. It's not a kinematic body, because a kinematic body pushes the tower with infinite force and reports no contacts with the platform. The first time it touches anything, or when the placer drops it (or the 15s run out), it's **released**: gravity on, sideways speed and spin zeroed, and from then on it's an ordinary piece. `step()` reports `released: {id, reason: 'touched' | 'dropped'}` once per piece.
- In a match, the placer's client moves the piece immediately (no waiting for the server), and sends `place:move {x, angle}` at up to 20 Hz. The server clamps the values, applies them, and its frames correct the placer's client if they drifted.
- **Reconnect**: the snapshot includes every body's position and velocity, so a returning player sees the exact tower.

Fully client-side lockstep was considered and rejected for v1. It uses less bandwidth, but one desync breaks a match and joining mid-match gets complicated. With the deterministic build, it remains an option later.

## A tower's world

- A static, flat **platform**, 6 units wide and 0.35 thick (a lip is easy to add if playtests want one). Pieces are about 1 unit across. Below it, a kill zone. Any piece whose centre drops more than 2 units under the platform is a **fumble**: it's removed and the event is reported.
- Gravity −9.81. The placed piece spawns 6 units above the tower and lowers at 0.8 units/s (5 with `↓`): about 7–8 seconds to aim and rotate before it touches anything.
- Default materials: friction 0.8, restitution 0.05, small linear and angular damping, so pieces slide on steep slopes but settle on gentle ones. "Ice" (the box exploit): friction 0.05.
- Mass from area at the same density for every piece. Since areas are [normalized](piece-pipeline.md#normalizing-the-scale), pieces weigh about the same.
- The placer can move the piece only within the platform width ± 2 units.
- The camera follows the higher of the tower's top and the line, with margin above.

## Height and topping out

- **Height** = the highest point of any piece that's asleep or nearly still (speed < 0.05) and touches the platform through a chain of contacts. A piece balanced in mid-air on the falling piece doesn't count.
- It's computed in the worker every 100 ms and sent as `tower:height`.
- Topping out: height ≥ line, continuously for 3s. A fumble or the height dropping below the line resets the countdown.

## Tuning values to find in the sandbox

| Value | Start | What to look for |
|---|---|---|
| Platform width / thickness | 6 / 0.35 | Can you place 3–4 average pieces side by side? |
| Height lines (short / medium / tall) | 6 / 10 / 15 | Matches of about 4 / 7 / 10 minutes |
| `A_target` / `L_max` / `t_min` | 1.0 / 3.0 / 0.2 | Pieces feel equal in weight but different in shape |
| Friction | 0.8 | Slanted pieces slide, flat ones stay |
| Lowering speed / spawn height | 0.8 u/s / 6 u | Enough time to aim within 15s |
| Gravity | 9.81 | With 1 m pieces things tumble about 30% faster than with the first 3 m² ones; lower it if stacking feels twitchy |
| Rotation step | 15° | Fine enough to fit shapes, coarse enough to be quick |

## Tests

- Headless and deterministic: "10 boxes stacked settle with no fumble", "a disc on a 30° slope rolls off", "a fumble is reported exactly once", "a snapshot restored gives identical frames".
- A performance test: a 40-piece tower steps in about **0.05 ms** (M-series laptop). The test fails above 2 ms per step. So 20 rooms × 2 towers at 60 Hz is about 0.1 of one core: a worker thread is still worth it, but physics cost isn't a concern.

All of these are in `packages/tower-physics/src/world.test.ts`, except snapshot restore, which comes with reconnects in Phase 1.
