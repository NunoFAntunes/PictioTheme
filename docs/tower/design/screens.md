# Screens

Layout only. The look is in [visual-identity.md](visual-identity.md). Target: 1280×720 and up (PC), and tablets in landscape from 1024×768. Phones and portrait tablets get a "Doodle Tower needs a bigger screen" gate.

## 1. Home

Reworked on 2026-10-21 into a playful page with no explanations: the logo, who you are, and one toy holding the three ways in.

```
         🎈🎈              ┳🎈
        D  OO  DLE      T  O  WER          ← the O's are balloons, the T a plinth
                                 🎈🎈🎈
┌───────────────┐                🎈🎈🎈
│   [doodle]    │                 \ | /
│  ▀▀▀▀▀▀▀▀▀▀   │          ╔═══════════════╗
│ [✏️ Draw yourself]│      ║  QUICK GAME   ║
│ Your name     │          ╚═══════════════╝
│ [ Ana       ] │           /             \
└───────────────┘   ┌──────────────┐ ┌──────────────┐
                    │ Private game │ │ Create a lobby│
                    └──────────────┘ └──────────────┘
              ( How to play? )  ( Try pieces in the sandbox )
```

- **Logo** (`features/home/components/TowerLogo.tsx`): the three O's are balloons. Click one and it pops (a bang, shreds of rubber, its string drops), and a new one blows up 2.6s later. The T is the stone plinth with its grassy cap.
- **You** (`IdentityCard.tsx`): your avatar standing on a little plinth, **✏️ Draw yourself** and your name. Until you draw, the avatar is the bobble hat made from your name, changing as you type. Drawing opens the game's drawing board in a dialog; the doodle is cut out of the paper like a block (`drawn-avatar.ts`, with `cutout` from `canvas-engine`, as DoodleWhirl does) and kept in this browser. **Use the hat** goes back to the bobble hat.
- **The ways in** (`BalloonMenu.tsx`): a bunch of balloons carries the **Quick game** board, with **Private game** and **Create a lobby** hanging under it on strings. It drifts and the planks swing slowly; everything holds still while the pointer or focus is on it. **Private game** turns round on its strings to show the code field (a code or a pasted invite link) with **Join** and ✕. Picking a way in without a valid name shakes the card and focuses the name instead. Picking one with a name sends the bunch up into the sky ("wheee") while the room loads; if that fails, it floats back down with the error under it.
- **Popping the menu** (`menu-fall.ts`): the menu's balloons pop too. Each one gone makes it hang lower and tilt towards the side with fewer balloons; they all blow up again 5s after the last pop. Pop all six and the board and planks **fall into the village** behind the page (`scenery/backdrop-drops.ts`): they land on the lane with a thump, squash whoever is under them, and the villagers break them up with mallets. Once the lane is clear, four villagers run over and **build the menu again**: it appears on the ground with them hammering at either end, its balloons blow up one by one, and it floats back up to its place while they cheer (about 15 to 20s in all). With reduced motion nothing falls; the balloons just come back.
- **How to play?** opens three panels: draw it, build or send, top out.

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
- **Start building** and **Shuffle crews** sit under the invite, always on screen; others see "Waiting for the host to start…".

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

**Spells** sit in each tower's header, after its name: two slots. Your crew's are gold buttons (1 and 2), greyed out while you draw or while the other tower is already under a spell; the other crew's are plain icons, so you can see what's coming. A tower under a spell gets a badge in its top-left corner: a pulsing "Di is casting Fog!" for the 2s warning, then "🌫️ Fog 7s" or "🐦‍⬛ A magpie is circling… 22s". Fog itself is a bank of cloud over the top of the tower, solid for its crew and thin for the other. A **sky star** bobs beside a tower, just past its platform's edge, and a white ring fills around it while a piece holds it. Under **Shaky hand**, the drawer's stage shows a pulsing 〰️ SHAKY HAND tag. A **golden word** gets a gold frame and a ✨ GOLDEN tag, on your crew's drawing and on the other crew's in the sky. Banners: "✨ Golden word! Your crew got 🌫️ Fog", "🌫️ Fog incoming from Di!", "🐦‍⬛ A magpie took your *bridge*!".

On the towers, a cursed piece shows its curse: frost over a slippery or big-ice piece, a drooping doodle on a melted one. The banner says "🌀 Incoming: *bridge* (🧊 Slippery) from Cy".

Teammates see a "Cy is deciding…" line instead of buttons.

## 6. Placing

You place on your own tower, on the left. The placing controls are on the back of the play card, under the guess line: buttons (◀ ▶ ⟲ ⟳ ⬇ DROP, for tablets) with their keys beside them (← → move, ↑ rotate clockwise, ↓ faster, Space drops). They're always there, greyed out, so the card never jumps; they light up while you're placing, and the guess line is disabled for those 15s so the keys reach the tower. The piece floats down under a bunch of balloons, with a guide line down to the tower. Everyone else sees it move in the tower panel as normal.

## 7. Results

Both final towers side by side, zoomable. Hovering a piece shows its word, its drawer, and "stolen" or "sent" tags. Award cards. **Rematch** / **Shuffle crews** / **Leave**. **Share**: a PNG of the winning tower, rendered on the server.
