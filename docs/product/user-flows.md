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

## 2. Home page: the lobby is the front door

**Principle: every way into a game is one click from the home page.** There is no separate landing page, no "Play now" button and no name form standing between a visitor and a room. The home page (`/`) is the big interactive DoodleWhirl! logo with the ways in directly underneath, all above the fold. `/play` redirects to `/`.

```
Home (/)
 ├─ [⚡ Quick play] ───────────────► best public room (or a new public one) ──► Room
 ├─ [🔒 New private room] ─────────► new private room, default deck ─────────► Waiting room (share the code)
 ├─ [ ABC-DEF → ] (code or pasted invite link) ─────────────────────────────► Room
 ├─ Public room cards (click one) ──────────────────────────────────────────► Room
 └─ Opened via invite link /r/ABC-DEF ──────────────────────────────────────► Room (no name form)
```

| Player wants to… | Clicks from the home page |
|---|---|
| Just play with anyone | 1: Quick play |
| Host friends | 1: New private room, then share the code |
| Join a friend's room | type or paste the code, Enter (or open the invite link: 0) |
| Pick a public room | 1: its card |

### Identity without a gate

- On the first visit the player gets a **generated silly name** ("Sneaky Pickle", "Wobbly Crayon"): an adjective plus a doodle-ish noun, always 2–20 characters and passing the profanity filter. Until they draw one, their avatar is their initial in colour with an ink outline on a transparent background (not a filled square). Both are remembered in localStorage like chosen ones.
- A **"Playing as 🥒 Sneaky Pickle ✏️" chip** in the home header opens a small editor at any time: a name field (2–20 chars, profanity-filtered) and a small square pad to **draw your own avatar** (brush, eraser, fill, three sizes, a short palette, undo, start over; the doodle is cut out of its background). Leaving the pad blank keeps the current avatar. Nothing ever *requires* it.
- Players who still have the generated initial avatar are invited to **draw themselves in the waiting room**, which is dead time anyway (see §5).
- Registered users (Phase 3) use their saved name and avatar instead.

### Quick play

Joins, in order of preference: the public room that is **waiting** for players and has space, with the most players; otherwise a public room **in a match** with space, with the most players (they join as a guesser and draw from the next round, see §3); otherwise it **creates a public room** with the default deck, named after the player ("Sneaky Pickle's room"). Rooms the player was kicked from are skipped.

### Phones

Phones (see the phone gate in [next-features.md](../planning/next-features.md)) see the logo, with a short "open this on a tablet or computer" note where the actions would be.

## 3. Ways in, in detail

1. **Public room cards**, refreshed live, drawn as sticky notes on the paper. Each shows the room name, deck theme, player count / max, status (`waiting` / `in game`), difficulty badges, and a 🤪 badge if Silly Mode is on. Full rooms are greyed out. A note shows the room's cover, its most-liked drawing (game-rules.md, likes), once it has one. A "N doodling now" counter sits above them. Later: filters (theme search, "not started yet", "has space").
2. **Join with code**: a field that auto-formats input to `ABC-DEF` (it uppercases, drops invalid characters, and adds the dash). Pasting a whole invite link (`…/r/ABC-DEF`) works too.
3. **New private room**: creates the room at once with the default deck and settings; everything is changed in the waiting room (§4).
4. **Quick play**: see §2.

Joining an in-progress public game is allowed. The player joins as a guesser and is added to the drawing rotation from the next round.

## 4. Creating a room

Creating takes one click (§3): the room starts private (or public, via Quick play) with the default deck and settings. **The choices below are made in the waiting room**, by the host, while friends arrive. Picking the theme together is part of the fun, not a form to get through.

1. **Room name** (pre-filled, e.g. "Nuno's room") and **Public / Private** toggle.
1. **Language** (built 2026-10-07): the flag on the room card; the host types a language and picks it. Decks not in it are marked, and the room's deck must be translated (or another picked) before Start works. See [decks.md](decks.md#languages).
2. **Deck**: search box → results show deck title, theme tags, card counts per difficulty, play count, rating, and whether a silly pool exists. A "Preview" button shows 5 sample cards.
   - Not found → "Generate a deck for *'pirate cooking'*" (logged-in users only. Guests see a sign-up prompt).
3. **Difficulty**: multi-select chips `Easy` `Medium` `Hard` (at least one).
4. **Silly Mode**: toggle plus a mix slider (e.g. 25% silly cards).
5. **Game settings**: rounds (1–10, default 3), draw time (30–180s, default 80s), max players (2–16, default 10), **guess visibility** (`Show guesses` / `Hide guesses`), hints on/off, and word choice (pick 1 of 3, or a single random card).

When the room is created, the server generates a unique code and the host lands on the **waiting room** screen.

## 5. Waiting room

- Player list on the left (avatar, name, crown for host, ready state).
- Center ([screens.md](../design/screens.md#3-the-waiting-room-choosing-the-deck-house-rules) §3): the room's name as the title (the host renames it in place), then one card with the deck (its back cover, with 🚩 to report it, and the rules at a glance), the room code (click to copy) and share link. Then for the host the **deck library** (see §4) beside the **house rules** (editable by host only, read-only for others), with **Start game** at the foot of the rules.
- **"Draw yourself!"**: players still on their generated initial (§2) get the name field and avatar pad here, open to start with ("Not now" folds it to a one-line "Draw yourself" prompt). The host gets the prompt from the start, so the deck and rules stay in view. Saving updates their entry in everyone's player list at once, without leaving the room. Once they've drawn, the prompt is gone: the header's "you" sticker is where to change it.
- Any time, even mid-match, everyone can change their name or drawing with their "you" sticker (avatar, name, ✏️) in the room header.
- Chat is active.
- Host actions: **Start game** (needs ≥ 2 players), kick player, transfer host, change settings, **rename the room and switch public/private** (any time; a public room shows up on the home page's room notes).
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

**Built so far** (open to guests: 1 deck per player per day, 3 per network, a global daily budget): "✨ Generate a deck" in the host's deck picker (waiting room) → form (theme, notes, difficulties, silly on/off) → progress (polled, ~1 min) with a pad to draw the deck's [back cover](decks.md#back-cover) (or skip) → once the deck is ready and the cover is saved or skipped, it becomes the room's deck, and listed as "yours" in the deck pickers, where ✏️ redraws its cover. No review step or credits yet. Blocked themes are refused before anything starts ("We can't make a deck about that"). The deck is written in the room's language; a theme written in another language, or too unclear for a deck, is refused right away with the reason, without using up the daily deck ([ai-deck-pipeline.md](../technical/ai-deck-pipeline.md#theme-check)). Picking a deck that isn't in the room's language offers to translate it (~1 minute, shared with every later room in that language).

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
