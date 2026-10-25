# Screens

Layout only. The look is in [visual-identity.md](visual-identity.md). Target: 1280×720 and up (PC), and tablets in landscape from 1024×768. Phones and portrait tablets get a "Doodle Tower needs a bigger screen" gate.

**Big screens** (2026-10-25): everything is sized in rem, and the root font size grows past 1080p (`global.css`: `max(100%, min(0.8333vw, 1.4815vh))`), so a 1440p screen shows the interface 1.33× as big and a 4K screen at 100% 2×: it looks like 1080p instead of a small island in the middle. Up to 1920×1080 nothing changes. What code sizes in px follows with `uiScale()` (`lib/ui-scale.ts`): the tower view's ruler, bunting and labels, its header inset, the crew stage's avatars, the clipboard's measurements. The balloon menu writes its px layout out as rem. New px sizes in code should do the same.

## 1. Home

Reworked on 2026-10-21 into a playful page with no explanations: the logo, who you are, and one toy holding the three ways in.

```
🧢[WHO ARE YOU? Name yourself]✏  ↶ Psst! Introduce yourself!
         🎈🎈              ┳🎈
        D  OO  DLE      T  O  WER          ← the O's are balloons, the T a plinth
                                 🎈🎈🎈
                                 🎈🎈🎈
                                  \ | /
                           ╔═══════════════╗
                           ║  QUICK GAME   ║
                           ╚═══════════════╝
                            /             \
                    ┌──────────────┐ ┌──────────────┐
                    │ Private game │ │ Create a lobby│
                    └──────────────┘ └──────────────┘
              ( How to play? )  ( Try pieces in the sandbox )
```

- **Logo** (`features/home/components/TowerLogo.tsx`): the three O's are balloons. Click one and it pops (a bang, shreds of rubber, its string drops), and a new one blows up 2.6s later. The T is the stone plinth with its grassy cap.
- **You** (`features/account` `AccountCorner`): the "you" sticker every game and the portal share, in the top-left corner of every screen: your doodle leaning out of a white marker sticker with your name. Until you draw, the doodle is the bobble hat made from your name. It's the only place to change your name and drawing: a click opens the profile editor (DoodleWhirl's drawing pad), and what you save is your profile in every game. Without a name it says "Name yourself", and a scribbled arrow beside it asks you to introduce yourself.
- **The ways in** (`BalloonMenu.tsx`): a bunch of balloons carries the **Quick game** board, with **Private game** and **Create a lobby** hanging under it on strings. It drifts and the planks swing slowly; everything holds still while the pointer or focus is on it. **Private game** turns round on its strings to show the code field (a code or a pasted invite link) with **Join** and ✕. Picking a way in without a name opens the profile editor instead. Picking one with a name sends the bunch up into the sky ("wheee") while the room loads; if that fails, it floats back down with the error under it.
- **Popping the menu** (`menu-fall.ts`): the menu's balloons pop too. Each one gone makes it hang lower and tilt towards the side with fewer balloons; they all blow up again 5s after the last pop. Pop all six and the board and planks **fall into the village** behind the page (`scenery/backdrop-drops.ts`): they land on the lane with a thump, squash whoever is under them, and the villagers break them up with mallets. Once the lane is clear, four villagers run over and **build the menu again**: it appears on the ground with them hammering at either end, its balloons blow up one by one, and it floats back up to its place while they cheer (about 15 to 20s in all). With reduced motion nothing falls; the balloons just come back.
- **How to play?** opens the [how-to-play guide](#how-to-play).

Codes are `ABC-DEF`, same format and rules as DoodleWhirl; a pasted invite link becomes its code. Opening an invite link (`/r/ABC-DEF`) goes straight to the room (asking for a name first if there isn't one).

## 2. Waiting room

Reworked on 2026-10-21 to fit one screen with no scrolling (from 1024×768 up; the layout stops growing at 54rem tall).

```
 Doodle Tower                                                       🔊
┌─────────────────┐┌─────────────────┐ ┌─────────────────────────────┐
│ ORANGE CREW 3/6 ││ TEAL CREW  2/6  │ │ INVITE YOUR FRIENDS         │
│ ┌──┐ Ana  HOST  ││ ┌──┐ Rui        │ │   ┌─────────────────────┐   │
│ ┌──┐ Bea        ││ ┌──┐ Zé         │ │   │ the share card      │   │
│ ┌──┐ Carl       ││                 │ │   └─────────────────────┘   │
│                 ││ [ Join Teal ]   │ │ [ABC-DEF] [🔗 Copy invite link]│
└─────────────────┘└─────────────────┘ │ - - - - - - - - - - - - - - │
┌──────────────────────────────────────┐│ WHO CAN JOIN  Friends (●🔒) Anyone│
│ GAME RULES                           │└─────────────────────────────┘
│ 🚩 Height line   [Short|Medium|Tall] │┌─────────────────────────────┐
│ ⏱️ Drawing time       [45s|60s|90s] ││ [🔀 Shuffle] [ START BUILDING ]│
│ 💫 Fumble daze        [Off| 5s| 8s] ││   Each crew needs 2 players  │
│ 🦝 Steals (ON■)  🌀 Curses & spells (ON■)│└─────────────────────────────┘
└──────────────────────────────────────┘
```

- **Crews** on the left take the space that's left; a long list scrolls inside its crew. The host can move players between crews.
- **Game rules**: each rule on its own little plank with an icon tile. Choices are a sunken track with a sunny block that springs to the picked option (`ui/Segmented.tsx`); on/off rules are switches whose knob is a chunky block that springs across and tips to its side (`ui/Switch.tsx`). Other players see the same controls, locked, with a "🔒 Set by the host" tag.
- **Invite** on the right: the share card exactly as chat apps unfurl the invite link (the server draws it, `tower-share-card.ts`: a sign saying "Come build a tower with us!" carried by two bunches of balloons), the code, and **Copy invite link**. There is no separate "copy the card": the link unfurls into the card. **Who can join** is a switch, 🔒 Friends with the link or 🌍 Anyone (Quick game). Lobbies start private.
- **How to play?** sits beside the title in the header: friends who come in by an invite link never see the home page. It opens the [guide](#how-to-play).
- **Start building** and **Shuffle crews** sit under the invite, always on screen; others see "Waiting for the host to start…".

### How to play

`features/how-to-play`: one dialog, opened from the home page and the waiting room ("How to play?") and, during a match, from a round **?** next to the sound control (the score bar stops short for both). Reworked on 2026-10-24 from three text panels; the basics pages' looping pictures came the same day.

- **Ten pages in three sections**, one idea per page, a picture on the left and two or three short sentences on the right. **The basics** (enough to start): two crews and the bunting, your drawing is the block, guessing and the letter hints, Keep or Curse, placing and its keys. **Tricks**: stealing, fumbles. **Powers**: the curses, the spells, and the three ways to earn one.
- The section chips jump to a section; **Back** / **Next**, the dots or ← / → move between pages. The last page's button is **Let's play!** It always opens at the first page.
- **The basics pages play short loops** (`how-to-play/loops/`, 6–9 s each), acted out with real pieces: doodle-shape's sample drawings cut out with `makePiece` and `renderPieceBitmap`, as the tower shows them, in the meadow with its plinths, bunting and balloons. *Two crews*: blocks land on both towers, orange's passes the bunting, counts 3, 2, 1 (a second each) and tops out. *Your drawing is the block*: a house and a cactus are drawn, guessed, and drop as their blocks; the cactus rocks. *Guess it*: the letter mask and its hint, then "hat" (✗ Nope), "horse" (So close!), "house" (✓), and the drawing becomes its block. *Keep or curse*: the pointer keeps a house, which floats to your tower, then curses a cactus, which frosts over (Slippery), flies to theirs and slides as it lands. *Place it*: the boot comes down under its balloons with its guide; ← → ↑ light up as it's moved and turned level, Space drops it.
- Each loop is a pure function of time (`timeline.ts`; what's typed and which key is pressed when are in `scripts.ts`, unit-tested), drawn by `LoopCanvas` on a stage 340 px wide scaled to its box. It only runs while its page shows. A **pause** button sits in the picture's corner. **With reduced motion** each loop shows one still frame chosen to tell its story (`poster`), and there's no pause button.
- **The Curses and Spells pages show each power at work.** The list on the right is a picker (each curse or spell a button: icon, name, what it does, from `lib/curses.ts` and `lib/spells.ts`, the same words the decide card and the spell slots use). The picture on the left acts out the one picked on their tower (`loops/curses.ts`, `loops/spells.ts`); left alone, it tours them all, a loop each, and the list follows (`PowerPicker.tsx`). The effects are the game's own: Melt and Blob come out of `makePiece` with `melt`, Big ice and Blob grow by `bloat` with the protocol's 1.4×, Bouncy bounces at the real restitution (`bounceHeight`, tested) and counts down its 3 s, Shaky hand wobbles the drawing with the server's `shakePoints` and shows the wobbly block it makes, the Magpie and the Pigeons are the tower view's birds (`features/birds`) flying its paths, and Fog is the tower view's veil. Slippery and Big ice slide off a slope into the meadow (a fumble); the pigeons tip the top piece off. Each spell starts with its 2 s warning. Timings come from the protocol's tuning where it has them. The placing keys are listed in the text beside the Place it loop, which only shows four of them.
- **During a match** the game goes on behind it ("The match carries on while you read"). While it's open it catches every key before the match does, so K / C, 1 / 2, the arrows and Space don't play; closing it doesn't leave focus on the **?**, or Space would open it again.
- Every page is the same height, so the buttons don't jump; on a narrow screen the picture goes above the text and the dots hide.

Next ([the plan](../planning/status.md#next-tasks)): small playable versions (draw a block, guess or steal, keep or curse, place one), then hints in the match the first time each thing happens to you.

## 3. Game: guesser

Reworked on 2026-10-20: **the two towers are the show.** They take most of the width, so pieces falling off either side stay in view, and both are framed the same way (the placer's whole reach, so the plinth keeps its size and nothing zooms when you start placing). The middle column is narrower and holds only your crew's things.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ 🟠 Orange ▓▓▓▓▓▓░░ 4.2 m      TOP OUT 10 M  14:12      3.1 m ▓▓▓▓░░░░ Teal 🔵 │
├──────────────────────────┬──────────────────┬──────────────────────────────────┤
│ ● Your tower             │ YOUR CREW  _ _ E 42│ ● Teal tower       ┌──────────┐ │
│                          │ ┌──────────────┐ │                    │🦝 STEAL 38│ │
│        (sky, wide)       │ │ your crew's  │ │                    │ (small)  │ │
│ ─ ─ ─ 🎀 top-out line ─ ─│ │   drawing    │ │ ─ ─ ─ 🎀 ─ ─ ─ ─ ─ └──────────┘ │
│            ┌─┐           │ └──────────────┘ │                                  │
│           ▟███▙          │ ┌──────────────┐ │             ▄▟▙                  │
│        ▔▔▔▔▔▔▔▔▔         │ │ [guess…] GUESS│ │          ▔▔▔▔▔▔▔▔▔               │
│   villagers watching     │ │ ◀ ▶ ⟲ ⟳ ⬇ DROP│ │                                  │
│                          │ └──────────────┘ │                                  │
└──────────────────────────┴──────────────────┴──────────────────────────────────┘
```

- Your tower is always on the left (framed in your crew's colour), the other crew's on the right, whichever crew you're in. Each tower panel shows its queue, who's placing and their time, a dazed overlay during a fumble, and a topping-out countdown when it's above the line. Nothing else ever sits at the bottom of a tower.
- The middle column, top to bottom: your crew's drawing (the word or the letter mask, the drawer's name, the time left), then the **play card**. The board is as big as the column allows without pushing the card off the screen; any space left over is at the bottom.
- **The play card flips.** Its front is the drawing tools (for the drawer); its back is the guess line and the placing controls (for everyone else). It turns over by itself when you start or stop drawing.
- One guess line serves both drawings. There's **no guess log and no chat**: a "so close!" tag pops over the guess line for a moment, and that's all.
- **The other crew's drawing** hangs small in the top corner of their tower's sky, labelled "🦝 STEAL IT" (or the crew's name when steals are off), with its drawer and timer. No hints for thieves.
- Your crew's drawing shows "Hint soon…" until the letter mask appears at a third of the round.

## 4. Game: drawer

Your drawing is the board in the middle, with the word on it. The play card is turned to its front: the toolbar in the Tower style and, under it, a **live piece preview**, the filled silhouette the drawing would become right now, against a ruler of the platform's width. Both towers stay visible. You can't guess while you draw.

Drawing tools: brush (with sizes), eraser, a **paint bucket**, undo, clear, a short colour palette. The bucket only colours in **closed shapes**: tapping the background, or a shape with a gap, does nothing but say so ("The bucket only fills closed shapes"). It's paint only: enclosed areas are solid in the piece anyway ([piece-pipeline.md](../technical/piece-pipeline.md)), and the colour shows on the piece.

**Colour it in**: when a brush stroke closes a new shape, a pill of seven bright colours (yellow, orange, red, pink, purple, blue, green) pops up over it, and one tap fills it, like the bucket. It's offered only for a new shape: one that was open before the stroke, or one the stroke cut well down (a window drawn in a house), and not for tiny loops or a squiggle inside a shape that's already closed. The next stroke, undo, Escape or six seconds put it away.

## 5. Keep or Curse (the drawer)

When your drawing is guessed, the card flips over (the solver is drawing now) and this pops up over the middle column. A stolen piece pops up for the thief instead.

```
            ┌──────────────────────────────────────────┐
            │      Bea got it!  "WATERMELON"   ⏱ 4     │
            │                                          │
            │             ◖█████████◗   ← the piece     │
            │                                          │
            │  [ 🧱 KEEP & PLACE (K) ] [ 🌀 CURSE → TEAL (C) ] │
            │                          ❄️ Big ice: bigger, │
            │                             and slippery    │
            └──────────────────────────────────────────┘
```

The Curse button names the rolled curse and what it does. With curses off it's 💣 Send instead.

**Spells** sit in each tower's header, after its name: two slots. Your crew's are gold buttons (1 and 2), greyed out while you draw or while the other tower is already under a spell; the other crew's are plain icons, so you can see what's coming. A tower under a spell gets a badge in its top-left corner: a pulsing "Di is casting Fog!" for the 2s warning, then "🌫️ Fog 7s" or "🐦‍⬛ A magpie is grabbing the top piece…". Fog itself is a bank of cloud over the top of the tower, solid for its crew and thin for the other. A **sky star** bobs beside a tower, just past its platform's edge, and a white ring fills around it while a piece holds it. Under **Shaky hand**, the drawer's stage shows a pulsing 〰️ SHAKY HAND tag. A **golden word** gets a gold frame and a ✨ GOLDEN tag, on your crew's drawing and on the other crew's in the sky. Banners: "✨ Golden word! Your crew got 🌫️ Fog", "🌫️ Fog incoming from Di!", "🐦‍⬛ A magpie took your *bridge*!".

On the towers, a cursed piece shows its curse: frost over a slippery or big-ice piece, a drooping doodle on a melted one. The banner says "🌀 Incoming: *bridge* (🧊 Slippery) from Cy".

Teammates see a "Cy is deciding…" line instead of buttons.

## 6. Placing

You place on your own tower, on the left. The placing controls are on the back of the play card, under the guess line: buttons (◀ ▶ ⟲ ⟳ ⬇ DROP, for tablets) with their keys beside them (← → move, ↑ rotate clockwise, ↓ faster, Space drops). They're always there, greyed out, so the card never jumps; they light up while you're placing, and the guess line is disabled for those 15s so the keys reach the tower. The piece floats down under a bunch of balloons, with a guide line down to the tower. Everyone else sees it move in the tower panel as normal.

## The crews on stage

Decided 2026-10-21. Every player's drawn avatar is on screen, showing what they're doing. Both crews are shown, the other one smaller:

| Doing | Where their avatar is |
|---|---|
| Drawing | On their crew's drawing pad, in the bottom right corner (the other crew's drawer: the corner of their small drawing) |
| Guessing | Perched along the top of their crew's clipboard, either side of the clip, peeking over the paper (the other crew: along the top of their small drawing) |
| Keep or Curse | On the top left corner of the decide card (only your crew's: the other crew's decider stays on its rim) |
| Placing | On a little cloud beside the balloons over their piece, following it as it moves |
| Disconnected | Greyed out where they were, asleep (a "z") |

Avatars are stickers: the drawing with a paper border, standing on the bottom of its ink whatever its shape. While your own decide card covers the middle column, your crew's clipboard is empty, so nobody stands on the card. Your own cloud stays calm while you place: it never gets effects that would get in the way of the 15s.

**Moving about.** When someone's role changes, they crouch, jump and fly to their new place on an arc, kicking up a little dust, and squash as they land; moving along the rim (someone left it) is just a hop. When several move at once (a round solved: the solver to the pad, the drawer to the decide card, then on to a cloud), they take off a beat apart, and two who meet in the air bonk: a burst of stars, and both spin. A cloud fades in under a placer as they arrive, and drifts up and away when they leave it. Waiting avatars bob gently, each to their own beat. Each move has its sound ([visual-identity.md](visual-identity.md#crew-sounds)). With reduced motion, avatars just appear in their new place, silently.

**Acting out the powers.** The avatars act out what the powers do, for both crews:

| Power | What you see |
|---|---|
| Casting a spell | The caster leans back and lobs a glowing orb with the spell's icon across to the other tower; it lands on the tower's top just as the spell starts (after the 2s warning) and bursts into stars. Fog, the magpie and the pigeon then do what they always did |
| 〰️ Shaky hand | The victim crew's drawer shivers for the 10s, on their pad |
| 🌀 Curse | The decider hurls a purple orb with the curses' icons over to the receiving tower |
| 🦝 Steal | The thief, in a bandit's mask, dashes over to the other crew's drawing and runs back with it under an arm |
| A spell gained | Its icon flies into the crew's spell slot: from their drawing in a shower of gold confetti for a golden word (and the whole crew glows gold), from their tower for a star or a comeback |

While you place, your own avatar doesn't wind up or jump about (your cast still flies). The event banner stays on top of the avatars. With reduced motion, none of this plays.

**Reactions.** The crews react to how the match goes:

| When | What you see |
|---|---|
| Their drawing is guessed | The crew hops for joy, one after the other |
| Their drawing is stolen | The crew jumps, startled, with a red "!" over each head |
| A piece falls off their tower | A grey rain cloud pours on top of the tower for a couple of seconds |
| They're dazed | The crew sways, with stars circling their heads, until the daze ends |
| Their tower is topping out | The crew bounces in time for the countdown |

They're silent: the game's own sounds for these moments already play. You don't react while you place, the asleep don't, and with reduced motion nothing does.

## 7. Results

Both final towers side by side, zoomable. Hovering a piece shows its word, its drawer, and "stolen" or "sent" tags. Award cards. **Rematch** / **Shuffle crews** / **Leave**. **Share**: a PNG of the winning tower, rendered on the server.
