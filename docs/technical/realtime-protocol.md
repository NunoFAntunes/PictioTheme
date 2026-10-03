# Realtime Protocol

WebSocket at `wss://<domain>/ws?token=<joinToken>` (same origin as the site, see [architecture.md](architecture.md#deployment)). JSON messages for control. Drawing uses a compact array encoding (it can move to binary/MessagePack later without changing the semantics). All message types are defined once in `packages/protocol` with zod schemas, and the server validates every incoming message.

Envelope: `{ "t": "<type>", ...payload }`.

## Client → Server

| Type | Payload | Who | Notes |
|---|---|---|---|
| `room:settings` | partial settings | host | Waiting phase only (except visibility/hints) |
| `room:start` | — | host | ≥ 2 players |
| `room:kick` | `playerId` | host | |
| `room:transferHost` | `playerId` | host | |
| `room:pause` / `room:resume` / `room:skipTurn` / `room:end` | — | host | |
| `vote:kick` | `playerId` | any | |
| `turn:choose` | `index` (0–2) | drawer | Choosing phase |
| `draw:begin` | `id, tool, color, size, opacity, x, y` | drawer | Starts a stroke |
| `draw:pts` | `id, pts: [x,y,(p)]…` | drawer | Batched every ~33ms |
| `draw:end` | `id` | drawer | |
| `draw:fill` | `x, y, color, tolerance` | drawer | |
| `draw:undo` / `draw:redo` / `draw:clear` | — | drawer | |
| `guess` | `text` (≤ 60 chars) | guessers | Rate-limited |
| `chat` | `text` | anyone, not drawing | Waiting/reveal/results phases |
| `ping` | `ts` | any | Latency display |

## Server → Client

| Type | Payload | Notes |
|---|---|---|
| `room:snapshot` | full sanitized room state + current strokes | On connect/reconnect |
| `room:players` | player list | On join/leave/score change |
| `room:settings` | settings | |
| `phase:choosing` | `drawerId, endsAt` (+ `options` **only to drawer**) | |
| `phase:drawing` | `drawerId, endsAt, mask` (+ `word` **only to drawer**) | `mask` e.g. `"_____ __ _ ________"` |
| `hint` | `mask` | Letter revealed |
| `draw:*` | same as client draw messages | Forwarded to all except drawer |
| `guess:feed` | `playerId, kind: 'wrong'|'close'|'correct', text?` | See visibility rules below |
| `guess:self` | `kind, text` | Echo to the guesser with classification |
| `turn:solved` | `playerId, order` | "Ana guessed it!" |
| `phase:reveal` | `word, deltas, endsAt` | |
| `phase:results` | `ranking, awards` | |
| `error` | `code, message` | e.g. `ROOM_FULL`, `NOT_HOST`, `RATE_LIMITED`. Codes are the shared `ErrorCode` union in `packages/protocol` |
| `server:restarting` | — | Sent before a deploy or shutdown. The client shows a notice, then reconnects with backoff |

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
