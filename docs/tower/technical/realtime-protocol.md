# Realtime Protocol

One WebSocket per player: `wss://<tower-domain>/ws/tower?token=<joinToken>`. The schemas are the source of truth: `packages/protocol/src/tower/index.ts` (imported as `@pictiotheme/protocol/tower`). The envelope (`{ t, ...payload }`), heartbeat, strikes for invalid messages, rate limits, backpressure and snapshot-on-reconnect work like DoodleWhirl's ([realtime-protocol.md](../../technical/realtime-protocol.md)), through the same gateway (`apps/server/src/modules/realtime/realtime.gateway.ts`).

`team` is always `'orange' | 'teal'`.

## Joining

1. `POST /api/session/guest`: the guest cookie (shared with DoodleWhirl's API).
2. `POST /api/tower/rooms` (create, body: `displayName` and `avatar`) or `POST /api/tower/rooms/:code/join` → `{ code, joinToken }`. `GET /api/tower/rooms/:code` checks a code exists.
3. Open the socket with the token. Tower tokens have their own audience (`doodletower:ws`), so a DoodleWhirl token can't open a tower room and the other way round.

The server sends a `room:snapshot`, then a `tower:frame` per tower with every body's pose.

## Client → server

| Message | Payload | Who | Notes |
|---|---|---|---|
| `crew:join` | `{team}` | anyone, while waiting | |
| `crew:move` | `{playerId, team}` | host, while waiting | |
| `crew:shuffle` | — | host, while waiting | |
| `settings:update` | `{settings}` (partial `TowerSettings`) | host, while waiting | `roundSeconds`, `line`, `dazeSeconds`, `steals` |
| `match:start` | — | host | ≥ 2 connected per crew, crews one apart at most, words loaded |
| `match:rematch` | — | host, at the results | back to the waiting room, same crews |
| `draw:begin / pts / end / fill / undo / redo / clear` | as DoodleWhirl's | the drawer | points batched every 33 ms. The server keeps every fill (it can't see pixels); clients only send fills inside a closed shape, and every client skips one that would reach the canvas's edge |
| `guess` | `{text}` | guessers | checked against your crew's drawing, then (steals on) the other crew's |
| `piece:decide` | `{pieceId, choice}` | the decider: the drawer, or the thief for a steal | `choice`: `'build'` or `'send'` |
| `place:steer` | `{x?, angle?, fast?}` | the placer | target x (m), angle (rad), ↓ held; ≤ 20/s |
| `place:drop` | — | the placer | |
| `ping` | `{ts}` | anyone | → `pong`, for the clock offset |

Rate limits per socket: 60 messages/s overall (burst 120), guesses 3/s, steering 25/s.

## Server → client

| Message | To | Payload |
|---|---|---|
| `room:snapshot` | one player | everything: players, settings, phase, both crews (round, queue, placing, daze, height, topping), every piece, decisions pending, the match's end time, results |
| `room:players` | everyone | `{players, hostId}` |
| `room:settings` | everyone | `{settings}` |
| `round:start` | everyone, personalised | `{team, round}`: `round.word` only for the drawer, `round.mask` only for the drawer's crew |
| `round:hint` | the drawer's crew | `{team, roundId, mask}`, at ⅓ and ⅔ of the round |
| `crew:draw` | everyone but the drawer | `{team, op}` |
| `guess:result` | the guesser | `{target, text, result}`: `target` is the drawing it hit (`'steal'` only when correct); no `close` for a steal |
| `crew:feed` | the guesser's crew, not the guesser | `{playerId, target, text?}` for a wrong guess, `{…, solved: true}` for a right one |
| `round:end` | everyone | `{team, roundId, outcome, word, solverId?, pieceId?}`: `solved`, `stolen`, `expired`, `blank` (no piece), `drawer_left` |
| `piece:made` | everyone | `{piece, deciding}`: the shape, the strokes to draw it with, and who decides by when (`deciding.deciderId`, also on the piece) |
| `piece:queued` | everyone | `{pieceId, tower, sent}` |
| `place:start` | everyone | `{tower, placing: {pieceId, placerId, endsAt}}` |
| `place:end` | everyone | `{tower, pieceId}` |
| `tower:frame` | everyone | `{tower, tick, bodies}`: flat `[id, x mm, y mm, angle mrad, …]`, moving bodies only, 20/s; every body once a second |
| `tower:height` | everyone | `{tower, height, toppingUntil}`, when it changes by 5 cm or more |
| `tower:fumble` | everyone | `{tower, pieceIds, dazedUntil}` |
| `match:end` | everyone | `{results}`: winner, reason, heights, everyone's numbers, awards |
| `error` | one player | `{code, message}` |
| `pong`, `server:restarting` | | as DoodleWhirl's |

## Privacy rules

Enforced in `tower-core` (`views.ts` and `match.ts`) and unit-tested:

- `word` goes only to the round's drawer, until `round:end`.
- `mask` and `round:hint` go only to the drawer's crew.
- Guess texts go only to the guesser's crew (`crew:feed`). Close guesses aren't shown to teammates.
- Strokes go to everyone: stealing means watching the other crew draw.

## Frames

`tower:frame` is the most frequent message: about 20 bodies × 4 numbers × 20/s at peak. Clients draw 100 ms in the past and interpolate between the last two poses of each body (`apps/tower-web/src/app/realtime/frames.ts`). The placer's own client draws the piece at its local target, so moving and rotating feel instant; the server's frames catch up. Binary frames can replace the JSON integers later if bandwidth measurements say so.
