# User Flows

## 1. Identity: account vs guest

| Capability | Guest | Registered user |
|---|:-:|:-:|
| Join public / private rooms | ✅ | ✅ |
| Create (host) rooms | ✅ | ✅ |
| Choose display name and avatar | ✅ (per session) | ✅ (saved) |
| Search and use existing decks | ✅ | ✅ |
| Generate AI decks | ❌ | ✅ (free quota, then paid credits) |
| Rate / report decks | ❌ (report only) | ✅ |
| Stats, history, favourite decks | ❌ | ✅ |

**Guests** get an anonymous session (a signed cookie holding a random `guestId`). It survives a page reload, so a guest who refreshes mid-game rejoins as the same player. If a guest later signs up, their current session is upgraded in place.

**Accounts** can sign up with email magic link, Google, or Discord (Discord fits the audience well). We avoid passwords in v1 to cut down on support and security work.

## 2. Landing page

```
Landing
 ├─ [Play as guest] ──► Name & avatar picker ──► Lobby
 ├─ [Sign in / Sign up] ──► Auth ──► (first time: name & avatar) ──► Lobby
 └─ Opened via invite link /r/ABC-DEF ──► Name & avatar (if needed) ──► Room
```

- The name & avatar step is one small card: a text field (2–20 chars, profanity-filtered) and a small square pad where players **draw their own avatar** (brush, eraser, fill, three sizes, a short palette, undo, start over). Leaving it blank keeps the current avatar, or makes a coloured tile with their initial. Registered users skip it after the first time. Later, registered users can save avatars they've drawn and pick from them (Phase 3).
- Invite links (`/r/ABC-DEF`) go straight to the room once the user has a name.

## 3. Lobby

The lobby has three ways in:

1. **Public room list**, refreshed live. Each row shows the room name, deck theme, player count / max, status (`waiting` / `in game`), difficulty badges, and a 🤪 badge if Silly Mode is on. Filters: theme search, "not started yet", "has space".
2. **Join with code**: a field that auto-formats input to `ABC-DEF` (it uppercases, drops invalid characters, and adds the dash).
3. **Create room**: opens the room-creation dialog.

Joining an in-progress public game is allowed. The player joins as a guesser and is added to the drawing rotation from the next round.

## 4. Creating a room

Step 1 is required, everything else has defaults, and all of it can be changed later in the room's waiting screen.

1. **Room name** (pre-filled, e.g. "Nuno's room") and **Public / Private** toggle.
2. **Deck**: search box → results show deck title, theme tags, card counts per difficulty, play count, rating, and whether a silly pool exists. A "Preview" button shows 5 sample cards.
   - Not found → "Generate a deck for *'pirate cooking'*" (logged-in users only. Guests see a sign-up prompt).
3. **Difficulty**: multi-select chips `Easy` `Medium` `Hard` (at least one).
4. **Silly Mode**: toggle plus a mix slider (e.g. 25% silly cards).
5. **Game settings**: rounds (1–10, default 3), draw time (30–180s, default 80s), max players (2–16, default 10), **guess visibility** (`Show guesses` / `Hide guesses`), hints on/off, and word choice (pick 1 of 3, or a single random card).

When the room is created, the server generates a unique code and the host lands on the **waiting room** screen.

## 5. Waiting room

- Player list on the left (avatar, name, crown for host, ready state).
- Center: room code (large, click to copy), share link, the deck's back cover beside the code (with 🚩 to report the deck), settings (editable by host only, read-only for others).
- Chat is active.
- Host actions: **Start game** (needs ≥ 2 players), kick player, transfer host, change settings.
- If the host leaves, host passes to the longest-present player.

## 6. In-game

See [game-rules.md](game-rules.md) for the rules and [../design/screens.md](../design/screens.md) for the layout. In summary:

- **Drawer**: sees 3 candidate cards → picks one (10s timeout, otherwise random) → draws with full tools → sees guesses as they come in.
- **Guessers**: see the canvas live, word blanks (`_ _ _ _ _   _ _ _ _ _`), timer, and hints over time. They type guesses.
- **Everyone**: player list on the left shows avatars, names, and scores. If the host has enabled guess visibility, players' guesses appear next to them, and close guesses are redacted in red.

## 7. End of match

- A podium with the top 3, the full score table, and fun awards ("Fastest guesser", "Best near-miss").
- Optional **drawing gallery**: a replay or thumbnail of every drawing in the match, which players can download as PNG.
- Buttons: **Play again** (same room, same players), **Change deck** (host), **Back to lobby**.
- Registered users: "Rate this deck 👍 / 👎".

## 8. Deck generation (logged-in)

```
Search "pirate cooking" → no good match
   → [Generate deck]  (shows "2 of 3 free generations left" or credit balance)
   → Form: theme (prefilled), optional description/notes, language,
           include silly pool? (default yes), family-friendly (default on)
   → Generating… (streamed progress, ~20–60s), while the creator draws the deck's back cover (or skips)
   → Review screen: cards by difficulty; user can remove cards or regenerate once for free
   → Publish → deck appears in library and is selected for the room
```

If the user has no free generations or credits left, the generate button opens the credit purchase sheet (see [monetization.md](monetization.md)).

**Built so far** (open to guests: 1 deck per player per day, 3 per network, a global daily budget): "✨ Generate a deck" in the create-room deck picker → form (theme, notes, difficulties, silly on/off) → progress (polled, ~1 min) with a pad to draw the deck's [back cover](decks.md#back-cover) (or skip) → once the deck is ready and the cover is saved or skipped, the deck is selected, and listed as "yours" in the deck pickers, where ✏️ redraws its cover. No review step, language choice or credits yet. Blocked themes are refused before anything starts ("We can't make a deck about that").

## 9. Edge cases

| Situation | Behavior |
|---|---|
| Drawer disconnects mid-turn | 15s grace period. If they haven't returned, the turn ends with no penalty for guessers and the card is revealed |
| Host disconnects | Host passes to the next player after 30s. If they come back, they don't automatically get host back |
| Everyone but one leaves | The game pauses at "waiting for players". After 5 minutes the room closes |
| Room idle for 30 min (waiting state) | The room closes and its code is released |
| Room full | Join is refused with "Room full". Public list shows it as full |
| Invalid code | Inline error "No room with that code" with rate-limiting (see security doc) |
| Duplicate display names in a room | A suffix is added automatically: "Ana (2)" |
