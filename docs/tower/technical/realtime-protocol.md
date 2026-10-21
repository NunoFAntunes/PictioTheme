# Realtime Protocol

One WebSocket per player: `wss://<tower-domain>/ws/tower?token=<joinToken>`. The schemas are the source of truth: `packages/protocol/src/tower/index.ts` (imported as `@pictiotheme/protocol/tower`). The envelope (`{ t, ...payload }`), heartbeat, strikes for invalid messages, rate limits, backpressure and snapshot-on-reconnect work like DoodleWhirl's ([realtime-protocol.md](../../technical/realtime-protocol.md)), through the same gateway (`apps/server/src/modules/realtime/realtime.gateway.ts`).

`team` is always `'orange' | 'teal'`.

## Joining

1. `POST /api/session/guest`: the guest cookie (shared with DoodleWhirl and the portal: one guest and one profile, `/api/me`).
2. One of these → `{ code, joinToken }`:
   - `POST /api/tower/rooms`: create a lobby (body: `displayName`, `avatar`, and `isPublic`, false by default). With `testMode: true`, a private [test-mode](../planning/test-mode.md) room instead, refused (403 `FORBIDDEN`) where `TOWER_TEST_MODE` is off, which it is in production.
   - `POST /api/tower/rooms/quick-play` (body: `displayName`, `avatar`): Quick game. The public room with space that is waiting and has the most connected players; failing that, the fullest public match with space (newcomers join the smaller crew); failing that, a new public room hosted by the player.
   - `POST /api/tower/rooms/:code/join`. `GET /api/tower/rooms/:code` checks a code exists first.
3. Open the socket with the token. Tower tokens have their own audience (`doodletower:ws`), so a DoodleWhirl token can't open a tower room and the other way round.

A player in the room whose profile changes (the account widget, another game or the portal: the room page follows it) sends it with `PUT /api/tower/rooms/:code/me` (body: `displayName`, `avatar`; 403 for someone not in the room). Everyone gets `room:players`. No reconnect.

Sharing a room: `GET /api/tower/rooms/:code/card.png` is its share card (1200×630, `apps/server/src/modules/tower/tower-share-card.ts`), cached forever when asked for with `?v=<version>`, `no-cache` without it. `GET /api/tower/rooms/:code/embed` is the Open Graph page link-preview bots get for `/r/CODE` (Caddy sends known bots' user agents there), so an invite link pasted in Discord, Slack or WhatsApp unfurls into the card. Rooms have no name of their own: they're "<host>'s tower".

The server sends a `room:snapshot`, then a `tower:frame` per tower with every body's pose.

## Client → server

| Message | Payload | Who | Notes |
|---|---|---|---|
| `crew:join` | `{team}` | anyone, while waiting | |
| `crew:move` | `{playerId, team}` | host, while waiting | |
| `crew:shuffle` | — | host, while waiting | |
| `settings:update` | `{settings}` (partial `TowerSettings`) | host, while waiting | `roundSeconds`, `line`, `dazeSeconds`, `steals`, `powers` (curses on or off), `isPublic` (whether Quick game can bring people in). `testMode` can't be changed, and a test room stays private |
| `match:start` | — | host | ≥ 2 connected per crew, crews one apart at most, words loaded. In test mode, anyone in a crew: bots fill the rest |
| `match:rematch` | — | host, at the results | back to the waiting room, same crews |
| `draw:begin / pts / end / fill / undo / redo / clear` | as DoodleWhirl's | the drawer | points batched every 33 ms. The server keeps every fill (it can't see pixels); clients only send fills inside a closed shape, and every client skips one that would reach the canvas's edge |
| `guess` | `{text}` | guessers | checked against your crew's drawing, then (steals on) the other crew's |
| `piece:decide` | `{pieceId, choice}` | the decider: the drawer, or the thief for a steal | `choice`: `'keep'` or `'curse'` |
| `place:steer` | `{x?, angle?, fast?}` | the placer | target x (m), angle (rad), ↓ held; ≤ 20/s |
| `place:drop` | — | the placer | |
| `spell:cast` | `{slot}` (0 or 1) | anyone in the crew but its drawer | casts that spell at the other crew's tower; refused while it's already under one |
| `test` | `{action}` (`TestAction`) | anyone, test-mode rooms only | stand-ins for guessing: `solve` (yours or a steal), `rival` (the other crew's builder bot solves or steals and keeps or curses), `rival-cast`, `grant` (a chosen spell), `golden`, `stars`. `solve` and `rival` take an optional `curse` for the piece. See [test-mode.md](../planning/test-mode.md) |
| `ping` | `{ts}` | anyone | → `pong`, for the clock offset |

Rate limits per socket: 60 messages/s overall (burst 120), guesses 3/s, steering 25/s.

## Server → client

| Message | To | Payload |
|---|---|---|
| `room:snapshot` | one player | everything: players, settings, phase, both crews (round, queue, placing, daze, height, topping), every piece, decisions pending, the match's end time, results |
| `room:players` | everyone | `{players, hostId}` |
| `room:settings` | everyone | `{settings}` |
| `round:start` | everyone, personalised | `{team, round}`: `round.word` only for the drawer, `round.mask` only for the drawer's crew, `round.golden` for everyone |
| `round:hint` | the drawer's crew | `{team, roundId, mask}`, at ⅓ and ⅔ of the round |
| `crew:draw` | everyone but the drawer | `{team, op}` |
| `guess:result` | the guesser | `{target, text, result}`: `target` is the drawing it hit (`'steal'` only when correct); no `close` for a steal |
| `crew:feed` | the guesser's crew, not the guesser | `{playerId, target, text?}` for a wrong guess, `{…, solved: true}` for a right one |
| `round:end` | everyone | `{team, roundId, outcome, word, solverId?, pieceId?}`: `solved`, `stolen`, `expired`, `blank` (no piece), `drawer_left` |
| `piece:made` | everyone | `{piece, deciding}`: the shape, the strokes to draw it with, the rolled `curses` (what Curse would do), and who decides by when (`deciding.deciderId`, also on the piece) |
| `piece:queued` | everyone | `{pieceId, tower, sent, shape?}`: `sent` means cursed, its curses now apply; `shape` when a curse changed it (big ice) |
| `place:start` | everyone | `{tower, placing: {pieceId, placerId, endsAt}}` |
| `place:end` | everyone | `{tower, pieceId}` |
| `tower:frame` | everyone | `{tower, tick, bodies}`: flat `[id, x mm, y mm, angle mrad, …]`, moving bodies only, 20/s; every body once a second. Body −1 is the Pigeon spell's bird |
| `tower:height` | everyone | `{tower, height, toppingUntil}`, when it changes by 5 cm or more |
| `tower:fumble` | everyone | `{tower, pieceIds, dazedUntil}` |
| `crew:charges` | everyone | `{team, charges, gained?}`: a crew's spells changed; `gained: {spell, reason: 'golden' \| 'comeback'}` when one was added |
| `crew:spell` | everyone | `{team, spell}`: a spell cast at this crew's tower (`{spell, casterId, startsAt, endsAt}`, starting after the warning), or null when it's over |
| `crew:star` | everyone | `{team, star, caught?}`: the sky star by a crew's tower appeared or is being held (`{x, y, expiresAt, holdUntil}`), or it's gone (null; `caught` if it was caught) |
| `piece:magpied` | everyone | `{pieceId, from, to, casterId}`: a magpie moved a queued piece to the caster's crew's queue |
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
