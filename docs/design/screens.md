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

**The logo (built):** a sheet of ruled paper drops onto the desk. The "DoodleWhirl!" letters (Cherry Bomb One, coloured sticker letters with an ink outline) rain onto it, a pencil falls in and lands as if it has just written the "!" (its tip is painted in front of the letters, its body behind), and a swirl draws itself under "Whirl!". Then the letters are a toy: moving the mouse past them nudges and spins them, and you can grab one, drag it, and fling it into the others. They always spring back home, so the logo stays readable. There is no tagline or marketing copy: the page title is just "DoodleWhirl!" and the meta description says what it is. The server-rendered HTML is the finished picture; with `prefers-reduced-motion` there's no intro and no physics. Code: `apps/web/src/components/hero/`.

**The desk (built):** behind the paper, twelve lanes of faded hand-drawn doodles (silly, spooky, space, food, with squiggles between them) drift left and right, neighbouring lanes in opposite directions, slipping under the sheet and out the other side. Some lanes are pencil-grey, some in the logo's pop colours, all faded so the paper stays the focus; the spooky lane sits second from the top, where it shows above the paper too. Server-rendered SVG symbols moved by CSS only (no JS, no hover), laid out from a fixed seed so every render is the same picture; reduced motion keeps them still. Still props lie around the paper, drawn like the pencil, their inner ends under the sheet: a mug of coffee (and the ring it left on the paper's corner), an eraser and its crumbs, a paintbrush with a purple dab, two crayons. They're toys: the mug sloshes (the latte heart swirls, a ripple and a puff of steam, sometimes a spilt drop), the eraser rubs on a click or a scrub, wears down from its pink end and leaves crumbs, the paintbrush wiggles and flicks drops while its splat grows, and a crayon rolls and scribbles one of the desk's doodles beside it (the last three stay). Each plays a quiet sound from the existing set. With reduced motion the changes happen without the movement. They need desk beside the paper, so they show from 1024 px wide; the coffee ring always shows. Code: `apps/web/src/components/home/` (`DoodleDesk.astro`, art in `doodles.ts`; `DeskProps.tsx`, a `client:load` island; `CoffeeRing.astro`).

**The lobby (under the logo):** the "you" sticker, the three actions, and the room notes. Quick play is the biggest button. An empty room list says "No public rooms yet: Quick play starts one". Phones get the logo and a short "open this on a tablet or computer" note instead of the actions.

**The "you" sticker (top left of the paper):** your doodle, frameless as in the player list and with a white die-cut edge, leans out of a white lopsided marker sticker with "PLAYING AS" over your handwritten name and a ✏️ on its corner; it opens the name and drawing editor. Point at it and it straightens, and your doodle tips and boils. While you're still a plain letter (you never drew yourself), a loopy arrow scribbled beside it points back at it: "Psst! Introduce yourself! (draw your face, we won't judge)". It draws itself in after the intro and is gone once you've drawn.

## 2. Lobby

Retired: the home page is the lobby (§1). `/play` redirects to `/`. Filters for the room notes ("waiting", "has space", theme search) are still to come.

## Home → room (built)

The room is the home page's desk with the game on it, so entering one doesn't feel like a different site. The same desk and drifting doodles lie behind the room. They carry on from where they were, then stop and fade while a match is on. The room's sheet and the guess column (taped down) are paper, and the header has the logo in its coloured sticker letters. With a view transition (Chrome, Edge, Safari 18.2+, not with reduced motion), the hero logo shrinks into the header's top-left and the home page's paper straightens into the room's sheet. The mug, eraser, brush and crayons slide off their side of the desk, and the home tune keeps playing into the waiting room until the match starts. The way back reverses it and skips the home intro. The waiting room's panels are outlined in ink like the stickers, with headings in the logo's font. The room's empty frame (logo, sheet, guess column) is the first thing the room page shows, also while joining.

## Closing the room (built)

The host's controls are folded away behind a **Manage room** sticker with a crown in the header; pressing it pops Pause/Resume, Skip, End and Close room out beside it as hand-cut stickers (lopsided outlines, each tilted its own way, doodled icons). **Close room** is one of them, with a little paper ball on it. It asks on a slip of paper taped to the desk under it ("Close the room?", [Keep it open] [Crumple it up]), the same note **End** uses; no browser dialog. Confirming plays it out: the room (header, sheet and guess column) becomes one sheet of paper, creases spread across it while it scrunches up and turns, and it closes into a paper ball. The ball winds up and is kicked off the top-right of the desk, leaving a few ink speed lines, with a crumple and a thump-whoosh. Then the host is home, where a **new** sheet drops onto the desk (the home intro plays; the usual morph back is skipped). About two seconds. Guests see their room crumpled and kicked away the same way (with the sounds), then "The host closed this room." With reduced motion there's no animation: the host goes straight home and guests get the message. Code: `features/close-room` (`crumple.ts` is the animation), `ui/ConfirmNote.tsx`, `ui/PaperBall.tsx`.

## 3. The waiting room (choosing the deck, house rules)

There's no create-room form: rooms are made in one click (user-flows.md §3). The waiting room fills the sheet beside the players' margin (up to `max-w-6xl`) and lays itself out by its own width (a CSS size container), so it works the same beside the guess column, on a 1024 px laptop and on a tablet in portrait:

```
 ▨tape                                                                 tape▨
╭──────────────────────────────────────────────────────────┬┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮
│ ┌─────┐ Come draw & guess with us in                     ┆  room code   │
│ │cover│ Spooky Scribblers ✏️     [🔒|🌍] Private        ┆   GHY-CLL    │
│ └─────┘ Deck: Spooky Halloween in [🇬🇧 English]           ┆[Copy invite] │
│        (3 rounds) (80s to draw) (Easy · Hard)            ┆or as picture │
╰──────────────────────────────────────────────────────────┴┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯
        ( 🖍️ You're still a plain letter. Draw yourself while friends arrive! )
┌─ Pick a deck ─────────╥─────────────────────┐ ╭○○○○○○○○○○○○○○○○○○○○○○○○╮
│ ┌──┐ NOW PLAYING       ○ Featured · 14       │ │ House rules             │
│ │🎃│ Halloween Night   ○ (🎃✓Playing)[👻][🐱]│ │ LENGTH                  │
│ └──┘ Monsters, …       ○ [🧟][☕][🏚]        │ │  Quick (Classic) Long   │
│ 🔍 halloween, space, … ○ [🦖][🚀][🍕]        │ │ Up to ~19 min, 4 players│
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ○ [🐙][🌍][🎮]        │ │ CARDS Easy (Mixed)      │
│ (All) family silly …   ○                     │ │       Hard  🌀Chaos     │
│ Your decks · 1         ○ over the page:      │ │ RULES ☐Rush ☑Hints …    │
│ ┌┄┄┄┄┐ [🏴‍☠️✏️]          ○ Community ·         │ │ ▸ Fine-tune  3·80s·10   │
│ ┆✨new┆                 ○   newest first      │ │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│ └┄┄┄┄┘               1 ○                   2 │ │    [ Start game ▶ ]     │
└───────────────────────╨───────────────▐»▌───┘ │ 2 players, up to ~19 min│
  an open notebook, coil   ribbon, pull ↓ ▝▘    │ 2 players, up to ~19 min│
                                                  └─────────────────────────┘
```

- **The room card** (`RoomCard`) is the invite: a ticket drawn in ink on ruled paper (lopsided marker outline, hard ink shadow, two strips of tape), with the deck's back cover tilted on the left, "Come draw & guess with us in", the room's name, the deck's title with the language its cards are in beside it ("Deck: Halloween Night in 🇬🇧 English", the host's language picker), the rules as little stickers (rounds, draw time, and the difficulties or "Chaos mode!"; the share card says the same), and a yellow tear-off stub behind a dotted perforation with the **code** in sticker letters on one line. The card is kept short (small cover, no extra hint lines) so the host's workspace gets the room. Clicking the code or **Copy invite link** copies `/r/CODE`; **or copy it as a picture** copies the card as a PNG (`GET /api/rooms/:code/card.png`; where images can't be copied it opens in a new tab). Below ~42rem the stub moves under the card; below ~36rem the cover sits above the text. In Chaos mode, a deck without Chaos cards gets a dashed pink "Needs Chaos cards" chip beside its title.
- **The link unfurls into the card.** Pasted into Discord, Slack, WhatsApp, Telegram, X, etc., `/r/CODE` shows the same card as a large picture: Caddy sends those apps' link-preview bots (by User-Agent) to `GET /api/rooms/:code/embed`, a page of Open Graph tags whose image is `card.png?v=<version>`. The server draws it (`apps/server/src/modules/rooms/share-card.ts`: SVG with seeded wobbly outlines, rendered by resvg-wasm with Cherry Bomb One and Gochi Hand), 1200×630 with a transparent background, so it lies on the chat like a ticket. The version changes with the name, deck, cover or rules, so a new paste shows the current card; the drawing is cached with the room. It doesn't show players or public/private, which go stale.
- **The room's name** sits on the card in the logo's sticker letters (Cherry Bomb One, pop colours, ink outline). The letters pop on one by one, again after every rename, and hop when you point at them; a squiggle draws under them. Its size follows the card's width and the name's length (up to 3.25rem; 4rem on results). The host renames in place: click the name or ✏️, Enter or leaving the field saves, Esc cancels. The header doesn't repeat the name.
- **Public or private** is a doodled switch beside the name (`PrivacyToggle`): a padlock and a globe, a yellow highlighter blob sliding under the one that's on, and "Private" or "Public" next to it. The host flips it; players see it. When the name is long it wraps under the name.
- **Start game** sits at the foot of the house rules, not on the card: the card is the invite, Start is the host's last move after setting up. It's a doodled purple button, with "2 players here, up to ~N min" or "Waiting for at least one more player…" under it; players see "Waiting for the host to start…" under the card. In Chaos mode with a deck that has no Chaos cards, Start is off and says "Make the deck's Chaos cards, or pick another deck, to start".
- **Draw yourself** starts open for players on their generated initial; for the host it starts as a one-line prompt, so the deck and rules stay in view. Players who already drew see nothing here (the header's "you" sticker changes it). The host's rename ✏️ sits on a white badge.
- **The deck library** (host) is a **notebook lying open** beside the house rules' notepad (2026-10-12, `NotebookSpread` in `ui/Notebook.tsx`): two ruled pages of the same width with a wire coil down the middle and a pencilled page number in each bottom corner, outlined in ink with pages peeking out under it, always light like the notepad. It takes most of the width and is as tall as the house rules beside it (folded, `min(42rem, 80dvh)`), so the host's waiting room fits a 1080p screen without scrolling. **The first page** has "Pick a deck" over a red header line, the **room's deck** (its cover taped in, "Now playing", title, description and card count from the library), the translate and Chaos panels when they apply, a **search line** (🔍 and a handwritten line, "halloween, space, food…") and the **categories** as handwritten words, "All" first: the one you're on is circled in marker like a house-rules choice (the loop draws itself, the last one's is wiped off, the same little pop; pointing sketches a pencil loop), and **Your decks**: a dashed ✨ **Generate a deck** tile first (when the server allows generation; with it, the section shows even before you've made one), then the decks you generated. **The second page** is the library: **Featured** (all our curated decks, featured-ranked first) and, over the page, **Community** ("newest first": other players' public decks with a drawn cover, [decks.md](../product/decks.md#community-decks), 48 at a time with "Show more"). A **ribbon bookmark** comes out from under the bottom edge of the page (never over it), pink with a » arrow on its swallowtail end and no words (it sways once a moment after the room opens; pointing at it lengthens it and lifts the page's bottom corner a little). Press it, or **pull it down** and let go: it stretches as you pull (giving less the further it goes) and the page corner peels up with it; past the mark the page turns, short of it the ribbon springs back. The page **turns over the coil** onto the first page (a 3D turn hinged on the coil, ~0.7 s, with the card-flip sound; its blank underside fades as it lands, so the first page keeps what's on it) and Community is underneath, a new ribbon flipping over around its length and swinging as it lands, yellow with a « arrow, which turns the page back from the left. Each side keeps where it was scrolled. Folded, the ribbon hangs from the top of the second page and the sides fade; with reduced motion they just swap. A search's results take the page's place (the ribbon goes while they do), since search covers every public deck. Each page scrolls on its own (the ruled lines scroll with it), with sticky handwritten section headings over a red line. Below 40rem of its own width the notebook folds: the coil moves to the top, the first page sits over the second and the whole notebook scrolls as one. Category chips are the tags most decks share (`top-tags.ts`, top 6 with at least 2 decks); a category, like the search line, searches titles and tags across all public decks (server search, best 30). Your decks shows about two rows (8) plus the selected deck, then "Show all N decks" and "Show more" 48 at a time, so thousands of decks never render at once. Each deck's [back cover](../product/decks.md#back-cover) is **taped in**, a strip of washi tape on top and a slight tilt that's always the same for that deck (it straightens and lifts when you point at it); under it the title (handwritten), card count and "· 🌀" if it has Chaos cards (in Chaos mode, decks without them say "🌀 to make"). The room's deck is **circled in marker** with a "✓ Playing" stamp; "Your decks" have ✏️ to redraw the cover. Picking a cover changes the room's deck for everyone at once. **Generating turns to a fresh page**: a notepad ("A new deck") that grows to fit the form and the cover pad. In Chaos mode, a room deck without Chaos cards puts a panel on the first page: "No 🌀 Chaos cards yet" and **🌀 Make Chaos cards**, then a "Making Chaos cards…" spinner (the translate panel comes first if the deck also needs translating). No ratings, play counts or card previews yet.
- **House rules** are three quick choices and a fold-out (simplified 2026-10-12): **Length** (Quick 2×60s, Classic 3×80s, Long 5×120s, and "up to ~N min with M players": every turn run to the end of its clock; "custom length" when the numbers match no preset), **Cards** (one pick of four: Easy, Mixed "The deck's easy and hard cards", Hard, or 🌀 Chaos "Only the absurd cards"; it sets the mode and difficulties together, `card-pool.ts`; two by two in the host's narrow column), **Rules** (tick boxes: ⚡ Rush, 💡 Hints, 👀 Show guesses, 🃏 Pick from 3; pointing at or focusing one explains it in the line under them) and **Fine-tune** (folded, with "3 rounds · 80s · 10 players" in its summary: − / + steppers for rounds, draw time and max players; it starts open when the length is custom). The headings carry no emoji (2026-10-05). They're written on a spiral notepad (2026-10-12): a wire coil through punched holes along the top, ruled lines, the heading over a red header line, and two pages peeking out under it. Length and Cards are handwritten words, not pills: the chosen one is circled in purple marker, the loop drawing itself (~0.4 s) as the last one's is wiped off, with a little wiggle of the word and a soft pop (everyone sees and hears the host's pen). Pointing at a choice sketches a faint pencil loop round it; 🌀 Chaos is circled twice. A rule is a lopsided box that gets a marker tick, overshooting the box. With reduced motion the loops and ticks are just there. Players see them read-only, in two columns.
- Side by side when the room is at least 46rem wide (library | 21rem rules); stacked, library first, below that.
- **Players who aren't the host** (2026-10-12) get the house rules in the middle (the same 23rem notepad) with **toys either side** (`ToysAround`): things left lying on the sheet to mess with while they wait, like the home page's desk. The mug, the eraser and two crayons from the home page, a pencil that spins like a bottle, a rubber stamp that stamps WOW!/A+/GENIUS… in smudgy red ink, a paper fortune teller that tells silly drawing fortunes, and a paper ball to throw into a wastebasket (tally marks count the ones thrown from afar). "Bored? Poke things." is pencilled over them. Nobody else sees them. Narrower than 46rem, the rules go on top and the two sides of toys under them. The pink crayon lies low beside the mug, clear of the fortunes that pop up above the fortune teller. They're back on the results (§6).

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
- **Emotes** (2026-10-12, `features/emotes`, [game-rules.md](../product/game-rules.md#emotes)): clicking a character (a dashed ring shows on hover) fans four paper stickers out around it, towards the board (away from the right edge in the tablet's grid), with your charges (doodled bolts) on a small sticker above it, leaning away from the fan, and "+1 in 12s" while one recharges. Arrow keys move between them, Escape or a click elsewhere closes it. The animations play on a fixed layer over the whole page (`EmoteStage`), because the margin's column scrolls and would clip them: solo ones move your own character; for squish, slap and hug a copy of your character flies over while the real one hides, and the target reacts at the hit (flattened, knocked aside, squeezed). Comic words ("SQUISH!", "SLAP!", "SPLAT!") in the logo font, and hand-drawn doodles (not emoji) for the wheel's icons, the feed lines and the flying hand, tomato, notes, tears, stars and hearts: wobbly ink over an offset crayon fill like `ui/ScribbleIcons`, with one set of path data (`doodles.ts`) for the React icons and the stage's sprites. The keyframes are computed from where the characters are (`choreography.ts`, unit-tested) and played with the Web Animations API.
- **In a match the list is a leaderboard**: sorted by score (ties share a rank and keep join order). When the order changes the characters slide to their new places, and whoever overtook someone grows, wiggles and glows as they pass. No motion with `prefers-reduced-motion` (no boil, sway, hop, float or slide either). The sort is display only: the drawing order is still the server's join-order rotation.

The ❤️ like button sits in the board's bottom-right corner while drawing and at the reveal (guessers press it; the drawer sees the count).

The header's right end has your "you" sticker (the home page's, sun-yellow and smaller: your frameless doodle leaning out of a lopsided marker sticker, a small YOU tag over your name in the same handwriting the player list uses for you, and a ✏️ on its corner; it opens the name and drawing editor, any time) and the sound settings. Players' handwritten names get a thin stroke in their own colour so the fonts read bolder.

**The guess bar** (built 2026-10-08, `GuessBar`): a strip of paper of its own, a little below the feed, taped down on the right. A tilted sticker tab on its top edge says what it's for: "Your guess" (sun yellow), "Solvers' chat" or "Chat" (teal), "You're drawing!" (grey). You write on a dashed blue line, in handwriting for Latin-script languages. Send is a small ↵ keycap, since Enter does the same. Between them, where the browser can listen, a doodled pink microphone: hold it while you talk, or tap it to leave it open for guess after guess (decisions.md D11). While it listens it tips over, a red ring pulses round it, and a speech bubble over the strip shows the words as they're heard ("Listening…" before that, "✓ “…” sent" after); a problem shows in the same bubble with a red outline for a few seconds.

**The rush meter** (2026-10-10, `RushMeter` in features/room-header, [game-rules.md](../product/game-rules.md#rush)): in a rush turn, once someone has guessed, a bar pops in under the word in the header. It is outlined in ink and filled sun yellow, turns tomato in its last quarter, and drains with the time left. Players who haven't guessed see what a guess is worth right now beside it ("+175"); the drawer and solvers only see the bar. It is redrawn every frame from the server clock and freezes while paused.

Drawer's view: the header shows the **full word** (e.g. "VAMPIRE BUYING SUNSCREEN") instead of blanks. The guess bar is disabled, with no mic, and reads "You're drawing!".

**Tablets in portrait** (built; any screen under 1024 px wide, while tablets in landscape and laptops get the sheet and the guess column): the canvas takes the top of the screen, at most ~56% of its height. The drawer's toolbar sits right under it. Below that, tabs switch between [Guesses] (the default, with a count of new lines while you're on Players) and [Players] (the same characters in a wrapping grid on a strip of paper), and the guess bar is pinned at the bottom, apart from the tabs. Mid-match the page doesn't scroll, only the tab content (and, if a tall header leaves too little room for board, toolbar and tabs, the board area rather than the tabs). The lobby also stacks below 1024 px, "Join with a code" first.

**Phones** get the "bigger screen" page (`features/phone-gate`, [next-features.md](../planning/next-features.md) 1.3). If a phone guess-only mode comes later: the player list becomes a horizontal avatar strip above the canvas with the guess bubbles shown as small overlays.

## 5. Turn transitions

- **Choose card overlay** (drawer): three big cards with a kind badge and the drawer's multiplier ("Easy ×1", "Hard ×2", "🌀 Chaos ×2"). A 10s ring timer. Under each card, 👍/👎 to rate it without picking it (card quality metrics).
- **Waiting overlay** (others): "Nuno is choosing a card…" ("…is dealt a card…" with 🃏 Pick from 3 off).
- **One card** (🃏 Pick from 3 off): the same table with a single card, "Your card" and "Drawing starts in Ns, or tap the card" (3.5s, no 👍/👎).
- **Card animation**: a deck sits in the bottom-left of the board during choosing and reveal. When a turn starts it shuffles, deals the cards onto the table, and flips them face up for the drawer (others see them face down). The card backs are the deck's drawn back cover, or its default cover (the title on a coloured, striped tile) for decks without one. The picked card pops and the rest fall away. The animation is skipped with `prefers-reduced-motion` or when joining with under 5s left (2s for a single card).
- **Reveal overlay** (everyone): "The word was **VAMPIRE ON A UNICYCLE**", with per-player points earned. There is a small "🚩 unfair card" link.

## 6. Results

The deck's cover and title at the top (with 🚩 to report the deck), then **the podium ceremony**, then [Play again] [Change deck & settings] [Lobby], which are there from the start, so nobody waits for the show to press them. Players who aren't the host see "The host can start another match." and, under it, **the waiting room's toys** (`ToysAround` with no rules in the middle: the two sides of toys next to each other at any width). Logged-in users see "Rate deck 👍 👎" (not built). Code: `features/results` (`ceremony.ts` has the layout and the timeline, `PodiumCeremony.tsx` plays it).

**The ceremony (built, 2026-10-08)**, about 8 seconds, prototyped first and tuned at 0.75× speed:

1. The podium **scribbles itself** onto the sheet in ink (two passes, the second lighter), hatched in sun, teal and tomato, its numbers popping on; the ground line writes itself under it.
2. **3rd, then 2nd hop on** to their steps, squashing as they land (a thump each).
3. **Drumroll**: "And the winner is…" writes itself in handwriting, the two on the podium lean toward the empty top step, trembling, and their lines boil faster.
4. **The winner drops in** from above and squashes flat on landing; a crown falls onto their head, doodle confetti bursts (stars, hearts, squiggles, spirals, pencil shavings), "Bo wins!" pops on in the logo's sticker letters, and 2nd and 3rd jump. Cymbal and fanfare.
5. **The crowd** (4th and below) pops up in a wave under the podium, each with "#5 · 640".
6. **Award stickers** (⚡ Fastest guesser, 🎨 Best drawer, ❤️ Crowd favourite) are slapped onto their owners, who shake.
7. **Idle**: the winner does a hop with a full turn every 4.5 s (mid-turn you see the back of the paper: the doodle mirrored and faint), everyone else sways, and **last place keels over** once like a plank, lies there, and pops back up. Tapping a character pokes it (a hop and a boing; the winner also spins and throws a little confetti). Pokes are local: nobody else sees them.

Each player stands as their own doodle (avatar, boil, name in their handwriting font) with their score on the step. **Ties share a step**, which widens; a place nobody holds has no step (1, 1, 3: no 2nd step). **Two players**: the empty 3rd step stays, "(nobody)" on it, with a tumbleweed rolling across. Everyone tied for first: nobody keels over. The figures shrink to keep the podium on one row of the sheet.

**When it plays**: only when the match ends while you watch. Joining or reconnecting during results (a snapshot), or coming back from Change deck & settings, shows the finished podium with no sound. **Tapping the ceremony, or Skip ▸**, jumps to the end and cuts off its sounds. **Reduced motion**: the finished podium, still, with the results jingle. Sounds: [sounds.md](sounds.md).

[Change deck & settings] (host) swaps the results for the waiting room's own screen (§3): the room card, the deck library and the house rules, with "Play again ▶" at the foot of the rules and "← Back to results" above the card. Draw yourself and the waiting-room music stay out of it.

## 7. Deck generation

A form, then a streaming progress view ("Brewing easy cards… hard… chaos…"), then a review grid where each card has an ✕ to remove it, then [Publish & use].

**Built so far:** the form, then a polled progress line, with the 3:4 cover pad in a paper popup that opens by itself (the full drawing toolbar beside it, [Skip] and [Save cover ✓]; closing it keeps the drawing, and the panel has [No cover] and [Draw the cover] to reopen it). No review grid yet.

## Accessibility

- Colour is never the only signal: close guesses are red **and** redacted **and** carry an icon/label ("close") for screen readers.
- Everything except drawing works with the keyboard. Timers are announced via `aria-live` at 10s.
- Colour-blind friendly palette for UI states. The drawing palette has labelled swatches (via tooltip).
