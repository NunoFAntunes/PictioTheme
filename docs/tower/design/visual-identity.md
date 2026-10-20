# Visual Identity

Doodle Tower must not look like DoodleWhirl. The two games share code, but **no visual elements**.

## Never reuse from DoodleWhirl

Ruled notebook paper, the purple whirl, the yellow pencil, sticker-style tilted buttons, DoodleWhirl's fonts, its palette, its sounds, its favicon. If a component comes from DoodleWhirl, only its **behaviour** is reused, never its skin (see [architecture.md](../technical/architecture.md#frontend)).

## Direction: "Sunny meadow" (chosen 2026-10-20)

The look is bright and playful, close to *Tricky Towers*: two towers rising out of a sunny meadow into the sky, past the clouds. It replaced the first direction ("Building site": blueprint blue, plywood, hazard stripes, cranes), which looked too much like a construction site.

| Element | Treatment |
|---|---|
| Background | A bright blue sky with a sun, clouds drifting by, rolling green hills, trees, a village of little houses and fences on the horizon, and **villagers standing about the meadow** at the bottom (they stay put, so nothing wanders under the play). Balloons drift up and small flocks of birds cross now and then. One canvas behind every page (`features/scenery/components/SceneBackdrop.tsx`) |
| Tower views | Each tower stands on a **stone plinth with a grassy cap** in its own patch of meadow, at the heart of its own **village**: a row of cottages on the hill behind, houses, trees and fences in front, and villagers standing on the lane looking up at the tower. The sky deepens from a hazy horizon to deep blue as the view rises, and clouds sit every few metres, so a growing tower climbs **past the clouds** (`features/tower/renderer.ts`) |
| Panels | Chunky rounded **white cards** with a thick lavender base (`card-panel`). HUD bars (score bar, drawing headers, tower headers, crew feed) are solid **dusk indigo** with white text, so they read on any part of the sky |
| Buttons | Rounded and chunky, with a thick darker base they press down into. Coral for main actions, sunny yellow for second ones, white for the rest |
| Accents | **Candy stripes** (yellow and coral) for warnings and timers running out (the daze) |
| Crews | **Orange crew** and **Teal crew**. Orange and teal stay easy to tell apart for most kinds of colour blindness. Never red against green |
| Pieces | The doodle itself, cut out of paper, with a soft shadow. The piece being placed floats down under a **bunch of balloons** |
| Height line | A string of **bunting** across the view with a "TOP OUT" tag. While a tower is topping out, the bunting turns gold and white and flutters, and the villagers at its foot jump and cheer |
| Typography | Display: **Lilita One** (chunky, rounded). UI text: **Fredoka**. Both Google Fonts (OFL), self-hosted by Astro. Titles straight on the sky are white with a dark outline (`title-outline`) |
| Avatar | A doodled face under a **bobble hat**, in a colour picked from the name (until players draw their own) |
| Motion | Light and bouncy: the title bobs, clouds drift, balloons sway. Villagers only move to cheer, so the ground stays calm while people play. Everything moving on its own stops with `prefers-reduced-motion` |
| Sound (Phase 2) | Light and cartoony: pops, boings, a soft thud on landing, a whoosh and a "wah-wah" on a fumble, a cheer for topping out. Kenney's CC0 "Impact Sounds" and "Interface Sounds" packs are candidates |

### Tokens

In `apps/tower-web/src/styles/global.css`: `dusk-*` (HUD indigo), `cloud` / `cloud-dim` (text on dusk), `sky`, `grass`, `card*`, `sun`, `coral`, `crew-orange`, `crew-teal`, `pebble`, `ink`, `paper`, `danger`. The canvas colours of the scenery are in `MEADOW` (`features/scenery/meadow.ts`).

## Art credits

All the sprites are **CC0** (public domain, no attribution required), by [Kenney](https://kenney.nl). Their licence files are in `apps/tower-web/public/scenery/`.

| Pack | What we use | Source |
|---|---|---|
| Toon Characters 1 | 5 characters (female/male person, female/male adventurer, robot): the 8 walk frames, 2 cheer frames and idle | [kenney.nl/assets/toon-characters](https://kenney.nl/assets/toon-characters) |
| Background Elements Redux | Clouds, trees, saplings, bushes, houses, a fence, the sun (the 2× PNGs) | [opengameart.org/content/background-elements-redux](https://opengameart.org/content/background-elements-redux) |

The hills, the meadow, the plinth, the birds, the balloons and the bunting are drawn in code.

Other free assets found and kept for later: Kenney's "Platformer Characters" and "New Platformer Pack" (more characters and layered backgrounds), "Jumper Pack" (flying critters), and the "Impact Sounds" and "Interface Sounds" audio packs, all CC0.
