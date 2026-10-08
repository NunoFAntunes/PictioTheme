# Screens

Low-fidelity wireframes. Desktop first, with mobile notes. Visual direction: playful, hand-drawn accents, high contrast, big touch targets.

## 1. Home (the lobby is the front door)

The flows are in [user-flows.md](../product/user-flows.md#2-home-page-the-lobby-is-the-front-door): every way into a game is one click, and there's no name form. Everything below sits above the fold on a laptop.

```
desk ─────────────────────────────────────────────────────────────────────
 🔊  ● online
 ┌──────────────────────────── paper ────────────────────────────────────┐
 │ 🥒[PLAYING AS Sneaky Pickle]✏  ↶ Psst! Introduce yourself!            │
 │                  D o o d l e   W h i r l ! ✏                          │
 │                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~                          │
 │                                                                       │
 │    [ ⚡ Quick play ]     [ 🔒 New private room ]    [ ABC-DEF  → ]     │
 │                                                                       │
 │    Public rooms · 23 doodling now                                     │
 │    ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                        │
 │    │🎃 Spooky│ │🍕 Pizza │ │🚀 Space │ │ (full) │   sticky notes, tilted │
 │    │ ~👻~   │ │  🍕~   │ │        │ │        │   + the room's cover   │
 │    │ 4/8 ●  │ │ 2/6 ●  │ │ 7/10 ▶ │ │ 10/10  │   ● waiting ▶ in game  │
 │    └────────┘ └────────┘ └────────┘ └────────┘                        │
 └───────────────────────────────────────────────────────────────────────┘
```

**The logo (built):** a sheet of ruled paper drops onto the desk. The "DoodleWhirl!" letters (Cherry Bomb One, coloured sticker letters with an ink outline) rain onto it, a pencil falls in and lands as if it has just written the "!" (its tip is painted in front of the letters, its body behind), and a swirl draws itself under "Whirl!". Then the letters are a toy: moving the mouse past them nudges and spins them, and you can grab one, drag it, and fling it into the others. They always spring back home, so the logo stays readable. There is no tagline or marketing copy: the page title and meta description carry that. The server-rendered HTML is the finished picture; with `prefers-reduced-motion` there's no intro and no physics. Code: `apps/web/src/components/hero/`.

**The desk (built):** behind the paper, twelve lanes of faded hand-drawn doodles (silly, spooky, space, food, with squiggles between them) drift left and right, neighbouring lanes in opposite directions, slipping under the sheet and out the other side. Some lanes are pencil-grey, some in the logo's pop colours, all faded so the paper stays the focus; the spooky lane sits second from the top, where it shows above the paper too. Server-rendered SVG symbols moved by CSS only (no JS, no hover), laid out from a fixed seed so every render is the same picture; reduced motion keeps them still. Still props lie around the paper, drawn like the pencil, their inner ends under the sheet: a mug of coffee (and the ring it left on the paper's corner), an eraser and its crumbs, a paintbrush with a purple dab, two crayons. They're toys: the mug sloshes (the latte heart swirls, a ripple and a puff of steam, sometimes a spilt drop), the eraser rubs on a click or a scrub, wears down from its pink end and leaves crumbs, the paintbrush wiggles and flicks drops while its splat grows, and a crayon rolls and scribbles one of the desk's doodles beside it (the last three stay). Each plays a quiet sound from the existing set. With reduced motion the changes happen without the movement. They need desk beside the paper, so they show from 1024 px wide; the coffee ring always shows. Code: `apps/web/src/components/home/` (`DoodleDesk.astro`, art in `doodles.ts`; `DeskProps.tsx`, a `client:load` island; `CoffeeRing.astro`).

**The lobby (under the logo):** the "you" sticker, the three actions, and the room notes. Quick play is the biggest button. An empty room list says "No public rooms yet: Quick play starts one". Phones get the logo and a short "open this on a tablet or computer" note instead of the actions.

**The "you" sticker (top left of the paper):** your doodle, frameless as in the player list and with a white die-cut edge, leans out of a white lopsided marker sticker with "PLAYING AS" over your handwritten name and a ✏️ on its corner; it opens the name and drawing editor. Point at it and it straightens, and your doodle tips and boils. While you're still a plain letter (you never drew yourself), a loopy arrow scribbled beside it points back at it: "Psst! Introduce yourself! (draw your face, we won't judge)". It draws itself in after the intro and is gone once you've drawn.

## 2. Lobby

Retired: the home page is the lobby (§1). `/play` redirects to `/`. Filters for the room notes ("waiting", "has space", theme search) are still to come.

## Home → room (built)

The room is the home page's desk with the game on it, so entering one doesn't feel like a different site. The same desk and drifting doodles lie behind the room. They carry on from where they were, then stop and fade while a match is on. The room's sheet and the guess column (taped down) are paper, and the header has the logo in its coloured sticker letters. With a view transition (Chrome, Edge, Safari 18.2+, not with reduced motion), the hero logo shrinks into the header's top-left and the home page's paper straightens into the room's sheet. The mug, eraser, brush and crayons slide off their side of the desk, and the home tune keeps playing into the waiting room until the match starts. The way back reverses it and skips the home intro. The waiting room's panels are outlined in ink like the stickers, with headings in the logo's font. The room's empty frame (logo, sheet, guess column) is the first thing the room page shows, also while joining.

## Closing the room (built)

The host's controls are folded away behind a **Manage room** sticker with a crown in the header; pressing it pops Pause/Resume, Skip, End and Close room out beside it as hand-cut stickers (lopsided outlines, each tilted its own way, doodled icons). **Close room** is one of them, with a little paper ball on it. It asks on a slip of paper taped to the desk under it ("Close the room?", [Keep it open] [Crumple it up]), the same note **End** uses; no browser dialog. Confirming plays it out: the room (header, sheet and guess column) becomes one sheet of paper, creases spread across it while it scrunches up and turns, and it closes into a paper ball. The ball winds up and is kicked off the top-right of the desk, leaving a few ink speed lines, with a crumple and a thump-whoosh. Then the host is home, where a **new** sheet drops onto the desk (the home intro plays; the usual morph back is skipped). About two seconds. Guests see "The host closed this room." With reduced motion there's no animation: the host goes straight home. Code: `features/close-room` (`crumple.ts` is the animation), `ui/ConfirmNote.tsx`, `ui/PaperBall.tsx`.

## 3. The waiting room (choosing the deck, house rules)

There's no create-room form: rooms are made in one click (user-flows.md §3). The waiting room fills the sheet beside the players' margin (up to `max-w-6xl`) and lays itself out by its own width (a CSS size container), so it works the same beside the guess column, on a 1024 px laptop and on a tablet in portrait:

```
 ▨tape                                                                 tape▨
╭──────────────────────────────────────────────────────────┬┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮
│ ┌─────┐ Come draw & guess with us in                     ┆  room code   │
│ │cover│ Spooky Scribblers ✏️     [🔒|🌍] Private        ┆   GHY-CLL    │
│ └─────┘ Deck: Spooky Halloween                           ┆[Copy invite] │
│        (3 rounds) (80s to draw) (Easy · Medium)          ┆or as picture │
╰──────────────────────────────────────────────────────────┴┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯
        ( 🖍️ You're still a plain letter. Draw yourself while friends arrive! )
┌─ Pick a deck ───────────── ✨ Generate a deck ─┐ ┌─ House rules ───────────┐
│ [🔍 Search decks: halloween, space, food…]    │ │ PACE                    │
│ (All) (family) (silly) (animals) (spooky) …   │ │ [⚡Quick][🎲Classic][🐢Long]│
│ ┌ scrolls inside, fixed height ─────────────┐ │ │ Up to ~19 min, 4 players│
│ │ FEATURED · 5               (sticky)       │ │ │ Rounds        − 3 +     │
│ │ [✓Playing][🍂][👻][🕸][🎃]                │ │ │ Draw time     − 80s +   │
│ │ MORE DECKS · 15                           │ │ │ CARDS  GUESSING         │
│ │ [🦖][🚀][🍕][🐙][🌍] … Show all 15 decks   │ │ │ PLAYERS (max)           │
│ └───────────────────────────────────────────┘ │ │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
└───────────────────────────────────────────────┘ │    [ Start game ▶ ]     │
                                                  │ 2 players, up to ~19 min│
                                                  └─────────────────────────┘
```

- **The room card** (`RoomCard`) is the invite: a ticket drawn in ink on ruled paper (lopsided marker outline, hard ink shadow, two strips of tape), with the deck's back cover tilted on the left, "Come draw & guess with us in", the room's name, the deck's title, the rules as little stickers (rounds, draw time, difficulties, "Silly mode!"), and a yellow tear-off stub behind a dotted perforation with the **code** in sticker letters on one line. The card is kept short (small cover, no extra hint lines) so the host's workspace gets the room. Clicking the code or **Copy invite link** copies `/r/CODE`; **or copy it as a picture** copies the card as a PNG (`GET /api/rooms/:code/card.png`; where images can't be copied it opens in a new tab). Below ~42rem the stub moves under the card; below ~36rem the cover sits above the text.
- **The link unfurls into the card.** Pasted into Discord, Slack, WhatsApp, Telegram, X, etc., `/r/CODE` shows the same card as a large picture: Caddy sends those apps' link-preview bots (by User-Agent) to `GET /api/rooms/:code/embed`, a page of Open Graph tags whose image is `card.png?v=<version>`. The server draws it (`apps/server/src/modules/rooms/share-card.ts`: SVG with seeded wobbly outlines, rendered by resvg-wasm with Cherry Bomb One and Gochi Hand), 1200×630 with a transparent background, so it lies on the chat like a ticket. The version changes with the name, deck, cover or rules, so a new paste shows the current card; the drawing is cached with the room. It doesn't show players or public/private, which go stale.
- **The room's name** sits on the card in the logo's sticker letters (Cherry Bomb One, pop colours, ink outline). The letters pop on one by one, again after every rename, and hop when you point at them; a squiggle draws under them. Its size follows the card's width and the name's length (up to 3.25rem; 4rem on results). The host renames in place: click the name or ✏️, Enter or leaving the field saves, Esc cancels. The header doesn't repeat the name.
- **Public or private** is a doodled switch beside the name (`PrivacyToggle`): a padlock and a globe, a yellow highlighter blob sliding under the one that's on, and "Private" or "Public" next to it. The host flips it; players see it. When the name is long it wraps under the name.
- **Start game** sits at the foot of the house rules, not on the card: the card is the invite, Start is the host's last move after setting up. It's a doodled purple button, with "2 players here, up to ~N min" or "Waiting for at least one more player…" under it; players see "Waiting for the host to start…" under the card.
- **Draw yourself** starts open for players on their generated initial; for the host it starts as a one-line prompt, so the deck and rules stay in view. Players who already drew see nothing here (the header's "you" sticker changes it). The host's rename ✏️ sits on a white badge.
- **The deck library** (host) takes most of the width and keeps a fixed height (`min(42rem, 80dvh)`), scrolling inside with sticky section headings, however many decks there are. ✨ Generate sits in its header; while generating, the form takes the panel's place. **Category chips** are the tags most decks share (`top-tags.ts`, top 6 with at least 2 decks); a chip, like the search box, searches titles and tags across all public decks (server search, best 30). Without a search: Your decks, Featured, More decks, about two rows each (8) plus the selected deck, then "Show all N decks" and "Show more" 48 at a time, so thousands of decks never render at once. Each tile has the [back cover](../product/decks.md#back-cover), title, card count and 🤪; the room's deck wears a "✓ Playing" sticker; "Your decks" have ✏️ to redraw the cover. Picking a cover changes the room's deck for everyone at once. No ratings, play counts or card previews yet.
- **House rules** are grouped by what they change: Pace (Quick 2×60s, Classic 3×80s, Long 5×120s presets, then − / + steppers for rounds and draw time, and "up to ~N min with M players": every turn run to the end of its clock), Cards (difficulty, Silly Mode and its share, drawer picks from 3), Guessing (show guesses, hints) and Players (max players). Short hints say what a switch does. The headings carry no emoji (2026-10-05). Players see them read-only, in two columns.
- Side by side when the room is at least 46rem wide (library | 21rem rules); stacked, library first, below that.

## 4. Game screen (the main one)

One **sheet of paper** holds the players and the canvas: the players stand in its left margin, right next to the drawing, with only a faint margin line between them. The guess feed and input are on the **right**. The sheet is always light, like paper, even in dark mode.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Round 2/3   ⏱ 0:47        _ _ _ _ _ _ _   _ _ _ _ _ _ _ _ _ (7, 9)  ⚙ │
├──────────────────────────────────────────────────────┬───────────────────┤
│ ┌────────────╎────────────────────────────────────┐  │ GUESSES / CHAT    │
│ │ 👑  /\_/\   ╎                                    │  │                   │
│ │ ✏️ ( o.o ) ⬮820                                 │  │ Ana: bat          │
│ │    Nuno    ╎                                    │  │ Rui: vampire      │
│ │  [███████] ╎          (canvas 4:3)              │  │ Ana: ███████  ←red│
│ │    🎃   ⬮610                                    │  │ 🎉 Rui guessed it!│
│ │    Ana     ╎                                    │  │                   │
│ │ ✅  🐺  ⬮540                                    │  │                   │
│ │    Rui     ╎                                    │  │                   │
│ │            ╎   (toolbar: only visible to drawer)│  │ [guess…] 🎤 ⏎    │
│ └────────────╎────────────────────────────────────┘  │                   │
└──────────────────────────────────────────────────────┴───────────────────┘
   ⬮ = score sticker   ╎ = faint margin line
```

Player details (`features/player-list`):

- **Each player is their own doodle.** The avatar is cut out of its background (transparent, cropped to the drawing, white enclosed by lines kept) and shown with no frame. It moves a little: the lines **boil** (SVG displacement filters switched about 8 times a second, like redrawn cartoon frames) and the character **sways** gently, out of step with the others. Sizes shrink as the room fills (about 120 / 88 / 64 px for ≤6 / ≤10 / more players). The column is centred vertically in the margin, and scrolls once it no longer fits.
- **Names are handwritten** under the character in one of ten messy Google Fonts (Rock Salt, Gloria Hallelujah, Gochi Hand, Schoolbell, Kranky, Sedgwick Ave, Walter Turncoat, Covered By Your Grace, Just Me Again Down Here, Fuzzy Bubbles), self-hosted. The font is picked from the player id and room code, so every client agrees and it can change between rooms (`name-font.ts`).
- **Points sit on a scribbled sticker** beside the character: a wobbly blob in a pop colour with the score in the logo font and a `#rank` tag. At the end of each turn a "+N" floats up from it and the number counts up to the server's new score.
- **States**: 👑 host (tilted on the head), ✏️ drawing (the character wiggles as if drawing), ✅ guessed (it hops), 💤 away (greyscale, faded, no boil).
- **Latest guess bubble** above the character when guess visibility is ON. It fades out after ~3s. Close guesses show as `█████` in red (the guesser sees their own text in red).
- The host gets a ⋯ menu on each player (kick, make host); others get vote to kick.
- **In a match the list is a leaderboard**: sorted by score (ties share a rank and keep join order). When the order changes the characters slide to their new places, and whoever overtook someone grows, wiggles and glows as they pass. No motion with `prefers-reduced-motion` (no boil, sway, hop, float or slide either). The sort is display only: the drawing order is still the server's join-order rotation.

The ❤️ like button sits in the board's bottom-right corner while drawing and at the reveal (guessers press it; the drawer sees the count).

The header's right end has your "you" sticker (the home page's, sun-yellow and smaller: your frameless doodle leaning out of a lopsided marker sticker, a small YOU tag over your name in the same handwriting the player list uses for you, and a ✏️ on its corner; it opens the name and drawing editor, any time) and the sound settings. Players' handwritten names get a thin stroke in their own colour so the fonts read bolder.

**The guess bar** (built 2026-10-08, `GuessBar`): a strip of paper of its own, a little below the feed, taped down on the right. A tilted sticker tab on its top edge says what it's for: "Your guess" (sun yellow), "Solvers' chat" or "Chat" (teal), "You're drawing!" (grey). You write on a dashed blue line, in handwriting for Latin-script languages. Send is a small ↵ keycap, since Enter does the same. Between them, where the browser can listen, a doodled pink microphone: hold it while you talk, or tap it to leave it open for guess after guess (decisions.md D11). While it listens it tips over, a red ring pulses round it, and a speech bubble over the strip shows the words as they're heard ("Listening…" before that, "✓ “…” sent" after); a problem shows in the same bubble with a red outline for a few seconds.

Drawer's view: the header shows the **full word** (e.g. "VAMPIRE ON A UNICYCLE" with a 🤪 tag) instead of blanks. The guess bar is disabled, with no mic, and reads "You're drawing!".

**Tablets in portrait** (built; any screen under 1024 px wide, while tablets in landscape and laptops get the sheet and the guess column): the canvas takes the top of the screen, at most ~56% of its height. The drawer's toolbar sits right under it. Below that, tabs switch between [Guesses] (the default, with a count of new lines while you're on Players) and [Players] (the same characters in a wrapping grid on a strip of paper), and the guess bar is pinned at the bottom, apart from the tabs. Mid-match the page doesn't scroll, only the tab content (and, if a tall header leaves too little room for board, toolbar and tabs, the board area rather than the tabs). The lobby also stacks below 1024 px, "Join with a code" first.

**Phones** get the "bigger screen" page (`features/phone-gate`, [next-features.md](../planning/next-features.md) 1.3). If a phone guess-only mode comes later: the player list becomes a horizontal avatar strip above the canvas with the guess bubbles shown as small overlays.

## 5. Turn transitions

- **Choose card overlay** (drawer): three big cards with a difficulty badge and points multiplier. A 10s ring timer. Under each card, 👍/👎 to rate it without picking it (card quality metrics).
- **Waiting overlay** (others): "Nuno is choosing a card…".
- **Card animation**: a deck sits in the bottom-left of the board during choosing and reveal. When a turn starts it shuffles, deals the cards onto the table, and flips them face up for the drawer (others see them face down). The card backs are the deck's drawn back cover, or its default cover (the title on a coloured, striped tile) for decks without one. The picked card pops and the rest fall away. The animation is skipped with `prefers-reduced-motion` or when joining with under 5s left.
- **Reveal overlay** (everyone): "The word was **VAMPIRE ON A UNICYCLE**", with per-player points earned. There is a small "🚩 unfair card" link.

## 6. Results

The deck's cover and title next to the heading (with 🚩 to report the deck), podium (top 3 with avatars), full table, awards, drawing gallery strip, and buttons [Play again] [Change deck] [Lobby]. Logged-in users see "Rate deck 👍 👎".

[Change deck & settings] (host) swaps the results for the waiting room's own screen (§3): the room card, the deck library and the house rules, with "Play again ▶" at the foot of the rules and "← Back to results" above the card. Draw yourself and the waiting-room music stay out of it.

## 7. Deck generation

A form, then a streaming progress view ("Brewing easy cards… medium… silly…"), then a review grid where each card has an ✕ to remove it, then [Publish & use].

**Built so far:** the form, then a polled progress line above the 3:4 cover pad with the full drawing toolbar (bigger targets on touch screens), [Skip] and [Done ✓]. No review grid yet.

## Accessibility

- Colour is never the only signal: close guesses are red **and** redacted **and** carry an icon/label ("close") for screen readers.
- Everything except drawing works with the keyboard. Timers are announced via `aria-live` at 10s.
- Colour-blind friendly palette for UI states. The drawing palette has labelled swatches (via tooltip).
