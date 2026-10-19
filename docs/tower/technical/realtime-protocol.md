# Realtime Protocol (sketch)

One WebSocket per player: `wss://<tower-domain>/ws/tower?token=<joinToken>`. The schemas live in `packages/protocol/src/tower/`. The envelope, heartbeat, rate limiting and snapshot-on-reconnect work like DoodleWhirl's ([realtime-protocol.md](../../technical/realtime-protocol.md)). This is a first sketch, to be made exact in Phase 1.

`team` is always `'orange' | 'teal'`.

## Client → server

| Message | Payload | Who | Notes |
|---|---|---|---|
| `crew:join` | `{team}` | anyone, while waiting | |
| `crew:move` | `{playerId, team}` | host, while waiting | |
| `settings:update` | `{deck, height, roundMs, daze, steals}` | host, while waiting | |
| `match:start` | — | host | needs ≥ 2 per crew |
| `draw:begin / pts / end / undo / clear` | as in DoodleWhirl | the current drawer | the crew is inferred from who sends it |
| `guess` | `{text, target}` | guessers | `target`: `'own' \| 'steal'`, i.e. the drawing in focus |
| `piece:decide` | `{pieceId, choice}` | the solver | `choice`: `'build' \| 'send'` |
| `place:move` | `{pieceId, x, angle}` | the placer | ≤ 20/s, clamped |
| `place:lower` | `{fast}` | the placer | holding `↓` |
| `place:drop` | `{pieceId}` | the placer | |

## Server → client

| Message | To | Payload |
|---|---|---|
| `room:snapshot` | one player | everything: crews, rounds, both drawings' strokes, queues, every tower body, timers |
| `round:start` | everyone | `{team, roundId, drawerId, endsAt}`. Plus `word` for the drawer only, and `mask` for the drawer's crew only |
| `round:hint` | that crew | `{team, roundId, mask}` |
| `draw:*` | everyone | DoodleWhirl's stroke messages plus `team` |
| `guess:result` | the guesser | `{roundId, result: 'correct' \| 'close' \| 'wrong', cooldownUntil?}` |
| `crew:feed` | that crew | `{playerId, text}` for wrong guesses, `{playerId, solved: true}` for correct ones |
| `round:end` | everyone | `{team, roundId, outcome: 'solved' \| 'stolen' \| 'expired', solverId?, word, piece?}` (`piece` = outline + parts in world units) |
| `piece:deciding` | everyone | `{pieceId, solverId, endsAt}` |
| `piece:queued` | everyone | `{pieceId, tower, origin: 'built' \| 'sent', fromTeam}` |
| `place:start` | everyone | `{pieceId, tower, placerId, endsAt}` |
| `tower:frame` | everyone | `{tower, tick, bodies: number[]}` (flat `[id, x, y, angle, …]`, integers) |
| `tower:height` | everyone | `{tower, height, toppingUntil?}` |
| `tower:fumble` | everyone | `{tower, pieceIds, dazedUntil}` |
| `match:end` | everyone | `{winner, reason: 'topped_out' \| 'time', towers, awards}` |

## Privacy rules (enforced on the server)

- `word` goes only to that round's drawer, until `round:end`.
- `mask`, `round:hint` and `crew:feed` go only to the drawer's crew.
- A steal guess gives no `close` result. It's `correct` or `wrong`.
- Spectators (joined mid-match, before being put in a crew) get neither crew's private messages.

## Later: binary frames

`tower:frame` is the most frequent message. Start with JSON integers. Switch to a binary `Int16Array` frame on the same socket if bandwidth measurements say so.
