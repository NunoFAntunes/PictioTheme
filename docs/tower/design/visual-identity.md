# Visual Identity

Doodle Tower must not look like DoodleWhirl. The two games share code, but **no visual elements**.

## Never reuse from DoodleWhirl

Ruled notebook paper, the purple whirl, the yellow pencil, sticker-style tilted buttons, DoodleWhirl's fonts, its palette, its sounds, its favicon. If a component comes from DoodleWhirl, only its **behaviour** is reused, never its skin (see [architecture.md](../technical/architecture.md#frontend)).

## Direction: "Sunny meadow" (chosen 2026-10-20)

The look is bright and playful, close to *Tricky Towers*: two towers rising out of a sunny meadow into the sky, past the clouds. It replaced the first direction ("Building site": blueprint blue, plywood, hazard stripes, cranes), which looked too much like a construction site.

| Element | Treatment |
|---|---|
| Background | A bright blue sky with a sun, clouds drifting by, rolling green hills, trees, a village of little houses and fences on the horizon, and **villagers busy with their jobs** along the bottom ([below](#villagers)). Balloons drift up and small flocks of birds cross now and then. One canvas behind every page (`features/scenery/components/SceneBackdrop.tsx`) |
| Tower views | Each tower stands on a **stone plinth with a grassy cap** in its own patch of meadow, at the heart of its own **village**: a row of cottages on the hill behind, houses, trees and fences in front, and villagers on the lane, busy, and in the way when a piece falls off ([below](#villagers)). The sky deepens from a hazy horizon to deep blue as the view rises, and clouds sit every few metres, so a growing tower climbs **past the clouds** (`features/tower/renderer.ts`) |
| Panels | Chunky rounded **white cards** with a thick lavender base (`card-panel`). HUD bars (score bar, drawing headers, tower headers, crew feed) are solid **dusk indigo** with white text, so they read on any part of the sky |
| Buttons | Rounded and chunky, with a thick darker base they press down into. Coral for main actions, sunny yellow for second ones, white for the rest |
| Accents | **Candy stripes** (yellow and coral) for warnings and timers running out (the daze) |
| Crews | **Orange crew** and **Teal crew**. Orange and teal stay easy to tell apart for most kinds of colour blindness. Never red against green |
| Pieces | The doodle itself, cut out of paper, with a soft shadow. The piece being placed floats down under a **bunch of balloons** |
| Height line | A string of **bunting** across the view with a "TOP OUT" tag. While a tower is topping out, the bunting turns gold and white and flutters, and the villagers at its foot jump and cheer |
| Typography | Display: **Lilita One** (chunky, rounded). UI text: **Fredoka**. Both Google Fonts (OFL), self-hosted by Astro. Titles straight on the sky are white with a dark outline (`title-outline`) |
| Avatar | A doodled face under a **bobble hat**, in a colour picked from the name (until players draw their own) |
| Motion | Light and bouncy: the title bobs, clouds drift, balloons sway. Villagers work at their jobs, each in their own spot (only passers-by cross the lane), so the ground looks lived in without anything running about for no reason. Everything moving on its own stops with `prefers-reduced-motion` |
| Sound | Light and cartoony: a bouncy, clappy theme ([music](#music)), little synthesised jingles for the match's moments ([game sounds](#game-sounds)) and the village's thumps and voices ([below](#village-sounds)) |

### Villagers

Code: `features/scenery/village.ts` (the simulation, pure and seeded, unit-tested), `village-draw.ts` (drawing), and `features/tower/fallout.ts` (the tower's village and its fallen pieces). Each player has their own village: it's cosmetic, the server knows nothing about it, and two players never see the same thing.

- **Jobs.** Everyone has one and stays at it: two neighbours **chatting** (taking turns, with speech bubbles, now and then a laugh), someone **hammering** at a fence, someone **watering** a flower bed, someone **sweeping** the lane, someone **carrying crates** from one pile to the other, and (by a tower) someone **watching** it go up. **Passers-by** walk in from one side and out the other, sometimes with a crate, sometimes stopping to wave, and come back a while later, maybe as somebody else. Tower villages put the busiest jobs either side of the plinth, where pieces fall.
- **A piece falls off** (tower views only; the home page and the waiting room only get the jobs). The physics forgets a fumbled piece 2 units under the platform, nearly on the ground; it carries on falling with the speed it had and lands on the lane with a thump, where it stays. Everyone within 7 units **jumps** with a "!", everyone further off **turns to look** with a "?".
- **Clean-up.** The closest villager who's free **runs over and breaks it up with a mallet**: the piece is cut into a grid of about nine cells, and each blow knocks off the nearest one, which flies away spinning, with crumbs. Then a little cheer, and back to work. More than six heaps about and the oldest one nobody's on crumbles by itself.
- **Squashed.** Anyone a piece lands on is **flattened under it**, then waddles about flat for ten seconds or so, squeaking at every other step, with stars round their head, then **pops back** into shape and goes back to work. Somebody else cleans up.
- **Topping out**: everyone not otherwise busy jumps and cheers.
- **Reduced motion**: the villagers hold their poses, and a fallen piece lands at once and stays.

### Sound

Code: `features/sound/`, a small Web Audio engine. The 🔊 button **top right on every page** opens a card with an on/off switch and a volume each for the **music** and the **effects**, remembered in `localStorage` as `doodletower.sound` (JSON). Everything goes through a master gain (the switch) and a bus each for the music and the effects; the volumes are squared, so the sliders feel even. A hidden tab goes quiet. Pages make room for the button on the right (the score bar, the sandbox's header); drawers such as the sandbox's workbench cover it.

Browsers allow audio only after a click or key press: the engine starts then, and sounds before that are dropped.

#### Music

The main theme for now: **"Happy Clappy Loop"** by OwlishMedia (2018, CC0), from [opengameart.org/content/happy-clappy-loop](https://opengameart.org/content/happy-clappy-loop). A 17.44 s seamless loop, as a 128 kbps MP3 with its LAME gapless header (`public/sounds/music/happy-clappy-loop.mp3`, licence beside it), so it loops without a click. It plays on every page, fading in on the first click, under the effects (45% at full volume, 60% by default).

#### Game sounds

Code: `room-cues.ts` picks them from what changed in the room view (pure, unit-tested), `game-sounds.ts` plays them, `use-room-sounds.ts` wires them into the room page. Only what matters to you, from where you stand; a reconnect replays nothing. All synthesised, so they sit with the villagers' voices.

| Sound | When |
|---|---|
| Pop | Someone joins the waiting room |
| "Ready… go!" (rising arpeggio) | The match starts |
| "Ta-da!" | It's your turn to draw |
| Two quick blips | It's your turn to place |
| "Ding-ding!" | Your guess is right (softer when a crewmate solved it) |
| "Hm?" wobble / soft bonk | Your guess was close / wrong |
| A sneaky run up and a "ting" | You or your crew stole the other crew's word |
| Muted "wah-wah-wah" | The other crew stole your crew's word |
| Dull "bwomp" | Nobody got your crew's word |
| Falling bomb whistle | A piece was sent to your tower |
| Soft woody thud (Kenney `thud-wood`) | A piece is let go on your tower |
| Whoosh and "wah-wah" | Your tower fumbled |
| Rising shimmer / two-tone alarm | Your tower / theirs went over the line (topping out) |
| Woodblock ticks | The match's last 10 s, and the last 3 s of your own placing (sharper for the last 3) |
| Fanfare / sad trombone / shrug | You won / lost / it's a draw |

### Village sounds

They play **whether or not the ground is in view**, so on a tall tower you hear what's happening down there. Panned by where along the lane they happen; the other crew's tower is quieter (40%).

| Sound | When | Source |
|---|---|---|
| Thump | A fallen piece hits the lane. Lower for bigger pieces, with a woody thud under the big ones | Kenney "Impact Sounds" (`impactSoft_heavy_000–002` as `thump-0…2`, `impactWood_heavy_000` as `thud-wood`), mono 96 kbps MP3 in `public/sounds/` |
| Whack | Each blow of the mallet | Kenney "Impact Sounds" (`impactPlank_medium_000–002` as `whack-0…2`) |
| Yelp | A piece lands near villagers (the two closest) | Synthesised: an "eep!", a quick rising triangle tone, at the villager's own pitch |
| Squish | A piece lands on somebody | Synthesised: a sinking low "bwomp", a squelch of filtered noise and a squeak from underneath |
| Squeak | Every other step of a squashed villager | Synthesised: a rubber-toy chirp |
| Pop | A squashed villager springs back | Synthesised: a rising bloop and a wobbly boing |

### Tokens

In `apps/tower-web/src/styles/global.css`: `dusk-*` (HUD indigo), `cloud` / `cloud-dim` (text on dusk), `sky`, `grass`, `card*`, `sun`, `coral`, `crew-orange`, `crew-teal`, `pebble`, `ink`, `paper`, `danger`. The canvas colours of the scenery are in `MEADOW` (`features/scenery/meadow.ts`).

## Art credits

All the sprites are **CC0** (public domain, no attribution required), by [Kenney](https://kenney.nl). Their licence files are in `apps/tower-web/public/scenery/`.

| Pack | What we use | Source |
|---|---|---|
| Toon Characters 1 | 5 characters (female/male person, female/male adventurer, robot): idle, walk (8), run (3), cheer (2), talk, think, hold, interact, switch (2), attack (3), jump, duck, hurt, down, show, behindBack | [kenney.nl/assets/toon-characters](https://kenney.nl/assets/toon-characters) |
| Background Elements Redux | Clouds, trees, saplings, bushes, houses, a fence, the sun (the 2× PNGs) | [opengameart.org/content/background-elements-redux](https://opengameart.org/content/background-elements-redux) |

The hills, the meadow, the plinth, the birds, the balloons, the bunting, the villagers' tools (hammer, mallet, watering can, broom, crates), the flower beds and the speech bubbles are drawn in code.

Other free assets found and kept for later: Kenney's "Platformer Characters" and "New Platformer Pack" (more characters and layered backgrounds), "Jumper Pack" (flying critters), and the "Interface Sounds" audio pack, all CC0. "Impact Sounds" is in use (above); its licence is `public/sounds/LICENSE-kenney-impact-sounds.txt`. The music is OwlishMedia's "Happy Clappy Loop" (CC0, [above](#music)).
