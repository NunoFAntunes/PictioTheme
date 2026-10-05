# Screens

Low-fidelity wireframes. Desktop first, with mobile notes. Visual direction: playful, hand-drawn accents, high contrast, big touch targets.

## 1. Home (the lobby is the front door)

The flows are in [user-flows.md](../product/user-flows.md#2-home-page-the-lobby-is-the-front-door): every way into a game is one click, and there's no name form. Everything below sits above the fold on a laptop.

```
desk ─────────────────────────────────────────────────────────────────────
 🔊  ● online                                 Playing as 🥒 Sneaky Pickle ✏️
 ┌──────────────────────────── paper ────────────────────────────────────┐
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

**The desk (built):** behind the paper, twelve lanes of faded hand-drawn doodles (silly, spooky, space, food, with squiggles between them) drift left and right, neighbouring lanes in opposite directions, slipping under the sheet and out the other side. Some lanes are pencil-grey, some in the logo's pop colours, all faded so the paper stays the focus; the spooky lane sits second from the top, where it shows above the paper too. Server-rendered SVG symbols moved by CSS only (no JS, no hover), laid out from a fixed seed so every render is the same picture; reduced motion keeps them still. Code: `apps/web/src/components/home/DoodleDesk.astro`, art in `doodles.ts`.

**The lobby (under the logo):** the header chip, the three actions, and the room notes. Quick play is the biggest button. An empty room list says "No public rooms yet: Quick play starts one". Phones get the logo and a short "open this on a tablet or computer" note instead of the actions.

## 2. Lobby

Retired: the home page is the lobby (§1). `/play` redirects to `/`. Filters for the room notes ("waiting", "has space", theme search) are still to come.

## 3. The waiting room (choosing the deck, house rules)

There's no create-room form: rooms are made in one click (user-flows.md §3). The waiting room fills the sheet beside the players' margin (up to `max-w-6xl`) and lays itself out by its own width (a CSS size container), so it works the same beside the guess column, on a 1024 px laptop and on a tablet in portrait:

```
                 Spooky Scribblers ✏️          ← sticker letters, scribbled underline
                 ﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏
┌─────────────────────────────────────────────────────────────────────────────┐
│ [cover] PLAYING WITH          ┆ 🔒 Private room · share ┆  [ Start game ▶ ] │
│ Spooky Halloween              ┆      GHY-CLL            ┆  2 players here    │
│ 3 rounds · 80s · Easy, Medium ┆  📋 Copy invite link    ┆                    │
│ · up to ~19 min               ┆                         ┆                    │
└─────────────────────────────────────────────────────────────────────────────┘
        ( 🖍️ You're still a plain letter. Draw yourself while friends arrive! )
┌─ 🎴 Pick a deck ────────── ✨ Generate a deck ─┐ ┌─ 📜 House rules ────────┐
│ [🔍 Search decks: halloween, space, food…]    │ │ ⏱ PACE                 │
│ (All) (family) (silly) (animals) (spooky) …   │ │ [⚡Quick][🎲Classic][🐢Long]│
│ ┌ scrolls inside, fixed height ─────────────┐ │ │ Up to ~19 min, 4 players│
│ │ FEATURED · 5               (sticky)       │ │ │ Rounds        − 3 +     │
│ │ [✓Playing][🍂][👻][🕸][🎃]                │ │ │ Draw time     − 80s +   │
│ │ MORE DECKS · 15                           │ │ │ 🃏 CARDS  💬 GUESSING   │
│ │ [🦖][🚀][🍕][🐙][🌍] … Show all 15 decks   │ │ │ 🚪 ROOM (public, max)   │
│ └───────────────────────────────────────────┘ │ └─────────────────────────┘
└───────────────────────────────────────────────┘
```

- **The room's name** is the page's title, in the logo's sticker letters (Cherry Bomb One, pop colours, ink outline). The letters pop on one by one, again after every rename, and hop when you point at them; a squiggle draws under them. Its size follows the room's width and the name's length (up to 4rem, wrapping only below 1.75rem). The host renames in place: click the name or ✏️, Enter or leaving the field saves, Esc cancels. The header doesn't repeat the name.
- **One "ready" card** holds everything needed to begin: what you'll play (cover, title and the rules at a glance, with the longest the match can take), the code to share, and **Start game** (host) or "Waiting for the host to start…". Below ~42rem it becomes the deck on top, then code and Start side by side.
- **Draw yourself** starts open for players on their generated initial; for the host it starts as a one-line prompt, so the deck and rules stay in view. Players who already drew see nothing here (the header's "you" sticker changes it). The host's rename ✏️ sits on a white badge.
- **The deck library** (host) takes most of the width and keeps a fixed height (`min(42rem, 80dvh)`), scrolling inside with sticky section headings, however many decks there are. ✨ Generate sits in its header; while generating, the form takes the panel's place. **Category chips** are the tags most decks share (`top-tags.ts`, top 6 with at least 2 decks); a chip, like the search box, searches titles and tags across all public decks (server search, best 30). Without a search: Your decks, Featured, More decks, about two rows each (8) plus the selected deck, then "Show all N decks" and "Show more" 48 at a time, so thousands of decks never render at once. Each tile has the [back cover](../product/decks.md#back-cover), title, card count and 🤪; the room's deck wears a "✓ Playing" sticker; "Your decks" have ✏️ to redraw the cover. Picking a cover changes the room's deck for everyone at once. No ratings, play counts or card previews yet.
- **House rules** are grouped by what they change: ⏱ Pace (Quick 2×60s, Classic 3×80s, Long 5×120s presets, then − / + steppers for rounds and draw time, and "up to ~N min with M players": every turn run to the end of its clock), 🃏 Cards (difficulty, Silly Mode and its share, drawer picks from 3), 💬 Guessing (show guesses, hints) and 🚪 Room (public, max players). Short hints say what a switch does. Players see them read-only, in two columns.
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
│ │            ╎   (toolbar: only visible to drawer)│  │ [type guess…] ⏎  │
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

The header's right end has your "you" sticker (a tilted sun-yellow pill: avatar, a small YOU tag over your name in the same handwriting the player list uses for you, and a ✏️ badge; it opens the name and drawing editor, any time) and the sound settings. Players' handwritten names get a thin stroke in their own colour so the fonts read bolder.

Drawer's view: the header shows the **full word** (e.g. "VAMPIRE ON A UNICYCLE" with a 🤪 tag) instead of blanks. The guess input is disabled and reads "You're drawing!".

**Tablets in portrait** (built; any screen under 1024 px wide, while tablets in landscape and laptops get the sheet and the guess column): the canvas takes the top of the screen, at most ~56% of its height. The drawer's toolbar sits right under it. Below that, tabs switch between [Guesses] (the default, with a count of new lines while you're on Players) and [Players] (the same characters in a wrapping grid on a strip of paper), and the guess input is pinned at the bottom. Mid-match the page doesn't scroll, only the tab content (and, if a tall header leaves too little room for board, toolbar and tabs, the board area rather than the tabs). The lobby also stacks below 1024 px, "Join with a code" first.

**Phones** get the "bigger screen" page (`features/phone-gate`, [next-features.md](../planning/next-features.md) 1.3). If a phone guess-only mode comes later: the player list becomes a horizontal avatar strip above the canvas with the guess bubbles shown as small overlays.

## 5. Turn transitions

- **Choose card overlay** (drawer): three big cards with a difficulty badge and points multiplier. A 10s ring timer. Under each card, 👍/👎 to rate it without picking it (card quality metrics).
- **Waiting overlay** (others): "Nuno is choosing a card…".
- **Card animation**: a deck sits in the bottom-left of the board during choosing and reveal. When a turn starts it shuffles, deals the cards onto the table, and flips them face up for the drawer (others see them face down). The card backs are the deck's drawn back cover, or its default cover (the title on a coloured, striped tile) for decks without one. The picked card pops and the rest fall away. The animation is skipped with `prefers-reduced-motion` or when joining with under 5s left.
- **Reveal overlay** (everyone): "The word was **VAMPIRE ON A UNICYCLE**", with per-player points earned. There is a small "🚩 unfair card" link.

## 6. Results

The deck's cover and title next to the heading (with 🚩 to report the deck), podium (top 3 with avatars), full table, awards, drawing gallery strip, and buttons [Play again] [Change deck] [Lobby]. Logged-in users see "Rate deck 👍 👎".

## 7. Deck generation

A form, then a streaming progress view ("Brewing easy cards… medium… silly…"), then a review grid where each card has an ✕ to remove it, then [Publish & use].

**Built so far:** the form, then a polled progress line above the 3:4 cover pad with the full drawing toolbar (bigger targets on touch screens), [Skip] and [Done ✓]. No review grid yet.

## Accessibility

- Colour is never the only signal: close guesses are red **and** redacted **and** carry an icon/label ("close") for screen readers.
- Everything except drawing works with the keyboard. Timers are announced via `aria-live` at 10s.
- Colour-blind friendly palette for UI states. The drawing palette has labelled swatches (via tooltip).
