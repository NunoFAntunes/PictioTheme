# Realtime Protocol

WebSocket at `wss://<domain>/ws?token=<joinToken>` (same origin as the site, see [architecture.md](architecture.md#deployment)). JSON messages for control. Drawing uses a compact array encoding (it can move to binary/MessagePack later without changing the semantics). All message types are defined once in `packages/protocol` with zod schemas, and the server validates every incoming message.

Envelope: `{ "t": "<type>", ...payload }`.

The join token lives 60 seconds, so **every connection, including a reconnect, first calls `POST /api/rooms/:code/join`** for a fresh token. The server's side of the protocol is the state machine in `packages/game-core/src/room/` (`step(state, event) → effects`).

## Client → Server

| Type | Payload | Who | Notes |
|---|---|---|---|
| `room:settings` | partial settings | host | Waiting phase only (except visibility/hints) |
| `room:details` | `name?, isPublic?` | host | Any time. Names are 2–40 characters and profanity-checked (`VALIDATION` error otherwise); a public room is listed on the home page |
| `room:start` | — | host | ≥ 2 players |
| `room:kick` | `playerId` | host | |
| `room:transferHost` | `playerId` | host | |
| `room:pause` / `room:resume` / `room:skipTurn` / `room:end` | — | host | |
| `room:close` | — | host | Any time. Ends a running match (recorded as `host_ended`), then closes every socket with 4007 and removes the room |
| `vote:kick` | `playerId` | any | |
| `turn:choose` | `index` (0–2) | drawer | Choosing phase |
| `turn:vote` | `index` (0–2), `vote` (`up`, `down` or `null` to take it back) | drawer | Choosing phase. Rates an option without picking it (card quality metrics) |
| `turn:like` | `liked` | anyone but the drawer | Drawing and reveal phases. ❤️ the current drawing or take it back (game-rules.md, likes) |
| `draw:begin` | `id, tool, color, size, opacity, x, y` | drawer | Starts a stroke |
| `draw:pts` | `id, pts: [x,y,(p)]…` | drawer | Batched every ~33ms |
| `draw:end` | `id` | drawer | |
| `draw:fill` | `x, y, color, tolerance` | drawer | |
| `draw:undo` / `draw:redo` / `draw:clear` | — | drawer | |
| `guess` | `text` (≤ 60 chars) | guessers | 3/s. From a player who already solved, it becomes a solvers-only `chat` |
| `chat` | `text` (≤ 200 chars) | anyone, not drawing | Not during drawing, except solvers (solvers-only channel) |
| `ping` | `ts` | any | Latency display |

## Server → Client

| Type | Payload | Notes |
|---|---|---|
| `room:snapshot` | full sanitized room state, current strokes, `deck`, `paused`, and `secret` (options/word only for those allowed) | On connect/reconnect |
| `room:players` | player list | On join/leave/score change, and when a player changes their name or avatar (`PUT /api/rooms/:code/me`, below) |
| `turn:likes` | `likers` | After every like or unlike. Cleared by the client at the next turn; the snapshot carries `likers` too |
| `cover:request` | `turn` | To the drawer only, as the reveal ends, when their drawing has strictly more likes than the room's cover. The client paints the stroke model off screen right away (before the next turn clears it), cuts it out and sends it: `PUT /api/rooms/:code/cover` with `{ turn, image }` (320×240 PNG). Stale uploads get `{ accepted: false }` |
| `room:details` | `name, isPublic` | After the host renames the room or switches public/private |
| `room:settings` | `settings, deck` | `deck` (`{ id, title, coverId }`, `coverId` null for the default cover) is `null` while a newly picked deck loads |
| `room:paused` | `paused: 'host' \| 'players' \| null` | `players`: auto-pause when only one player is left |
| `room:notice` | `code, playerId?, count?, needed?` | `pool_reshuffled`, `player_kicked`, `vote_kick` (progress), `host_changed`, `deck_unavailable` |
| `phase:choosing` | `drawerId, round, endsAt` (+ `options` **only to drawer**) | |
| `phase:drawing` | `drawerId, round, endsAt, mask` (+ `word` **only to the drawer and solvers**) | `mask` e.g. `"_____ __ _ ________"`. Re-sent with a new `endsAt` after a pause |
| `hint` | `mask` | Letter revealed |
| `draw:*` | same as client draw messages | Forwarded to all except drawer |
| `guess:feed` | `playerId, kind: 'wrong'|'close'|'correct', text?` | See visibility rules below |
| `guess:self` | `kind, text, word?` | Echo to the guesser. `word` is included once they are correct |
| `chat` | `playerId, text, solvedChannel?` | `solvedChannel`: from a solver, only sent to the drawer and other solvers |
| `turn:solved` | `playerId, order` | "Ana guessed it!" |
| `phase:reveal` | `word, deltas, endsAt` | |
| `phase:results` | `ranking, awards` | |
| `error` | `code, message` | e.g. `ROOM_FULL`, `NOT_HOST`, `RATE_LIMITED`. Codes are the shared `ErrorCode` union in `packages/protocol` |
| `server:restarting` | — | Sent before a deploy or shutdown. The client shows a notice, then reconnects with backoff |
| `pong` | `ts, serverTime` | Reply to `ping`. Used for latency and the clock offset |

### Close codes

| Code | Meaning | Client should |
|---|---|---|
| 4001 | Same player connected from another tab | Show "Opened in another tab", don't reconnect |
| 4003 | Kicked | Show a message, don't reconnect |
| 4004 | Room closed | Go back to the lobby |
| 4007 | Closed by the host | Show "The host closed this room" ("You closed the room" for the host), don't reconnect |
| 4005 | Room full | Show "Room full" |
| 4006 | Banned from this room | Show a message, don't reconnect |
| 1008 | Too many invalid messages | Don't reconnect |
| 1012 | Server restarting | Reconnect with backoff (the room is gone in v1) |

An upgrade with a bad or expired token is refused with HTTP 401 before a socket opens.

### Guess feed: who gets what

The server decides per recipient. **Correct and close guess text is never broadcast:**

```
for each recipient r:
  if kind == 'correct':           send { playerId, kind: 'correct' }               // no text
  elif r.isDrawer or r.solved:     send { playerId, kind, text }                    // can see everything
  elif visibility == 'hide':       skip (unless r == guesser)
  elif kind == 'close':            send { playerId, kind: 'close' }                 // client renders red ██████
  else:                            send { playerId, kind: 'wrong', text }
```

Messages from players who have already solved are sent only to the drawer and to other solved players.

## Drawing sync

**Model**: the drawing is a list of vector **strokes** (operations), not pixels.

```ts
type Stroke =
  | { id; tool: 'brush' | 'eraser'; color; size; opacity; pts: number[] }   // flat [x,y,p, x,y,p, …]
  | { id; tool: 'fill'; x; y; color; tolerance }
  | { id; tool: 'clear' }                                                 // draw:clear, stored so it can be undone
  | { id; tool: 'shape'; kind: 'line'|'rect'|'ellipse'; from; to; color; size; opacity; filled }
```

- Coordinates are in the **logical canvas space** (1200×900) and stored as integers (or ×10 for sub-pixel). This makes rendering resolution-independent.
- The drawer renders locally right away and sends `draw:begin`, then `draw:pts` batches every ~33ms, then `draw:end`. Viewers render each batch as it arrives, so they see the stroke being drawn live.
- Point reduction before sending: drop points < 1.5px from the previous one. Optionally apply Ramer–Douglas–Peucker simplification.
- **Undo/redo** are operations (`draw:undo`). Each client removes the last stroke and redraws from a cached bitmap checkpoint (snapshot every ~20 strokes) to avoid replaying hundreds of strokes.
- **Fill** runs on each client's rasterized canvas. Because everyone replays the same operations in the same order on the same logical resolution, the result is deterministic. Do the flood fill on an offscreen canvas at logical resolution, not device resolution, to keep it deterministic.
- **Late joiners / reconnects** get the stroke list in `room:snapshot` and replay it.
- **Server validation**: only the current drawer can send `draw:*`. Points are clamped to canvas bounds, and there are caps on points per message and per turn (e.g. 100k points) to stop bandwidth abuse.

### Bandwidth estimate

A fast scribble produces ~120 points/s × 3 numbers × ~4 bytes in JSON ≈ 1.5 KB/s, which is ~15 KB/s fan-out to 10 viewers. That's fine. MessagePack + delta-encoded int16 would cut it ~4×. Do that later if needed.

## Time

Every phase message includes `endsAt` (server epoch ms). Clients estimate clock offset from `ping`/`pong` and render `endsAt - (Date.now() + offset)`. The server alone decides when a phase ends.

## Connection lifecycle

```
connect(token) → server verifies JWT → adds/reattaches player → room:snapshot
heartbeat: ws ping every 20s; 2 missed → mark disconnected (grace period per user-flows edge cases)
close → mark disconnected; if not back within grace → remove from turn order
```

## Changing your name or avatar in a room

Not a socket message: avatars are PNG data URLs, and create/join already send them over HTTP. `PUT /api/rooms/:code/me` with `{ displayName, avatar }` (only for players in the room; names are profanity-checked, avatars stored like on join) hands the room an `identity` event (`packages/game-core/src/room/players.ts`: the name is made unique, then `room:players` goes to everyone). The client doesn't reconnect: `connectRoom` reads the current identity at each (re)connect, so later reconnects join with the new one too. Used by "Draw yourself!" in the waiting room and by the ✏️ avatar chip in the room header, any time (user-flows.md §5).
