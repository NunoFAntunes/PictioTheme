# Visual Identity

Doodle Tower must not look like DoodleWhirl. The two games share code, but **no visual elements**.

## Never reuse from DoodleWhirl

Ruled notebook paper, the purple whirl, the yellow pencil, sticker-style tilted buttons, DoodleWhirl's fonts, its palette, its sounds, its favicon. If a component comes from DoodleWhirl, only its **behaviour** is reused, never its skin (see [architecture.md](../technical/architecture.md#frontend)).

## Direction A (proposed): "Building site"

The theme is a construction race between two crane crews. It suits the game: pieces are delivered by crane, the height line is the **topping-out** flag, a collapse is a site accident.

| Element | Treatment |
|---|---|
| Background | Deep **blueprint blue** with a faint white grid, like architectural drawings. Gives towers high contrast |
| Panels | **Plywood / kraft cardboard** panels with screw heads in the corners |
| Accents | **Hazard stripes** (yellow and black) for warnings and timers running out. Safety orange for main actions |
| Crews | **Orange crew** and **Teal crew**: hard hats, flags, tower platforms. Orange and teal stay easy to tell apart for most kinds of colour blindness. Never red against green |
| Drawing canvas | White **tracing paper** on a clipboard. The doodles keep their own colours |
| Towers | Each sits on a steel platform with a **crane** above it. The crane's hook holds the piece being placed. The height line is a **topping-out ribbon** with a little tree and flag |
| Pieces | The doodle itself, with a thin dark outline around its collision shape so players see what's solid |
| Typography | Display: a signage or stencil face (e.g. *Bungee* or *Big Shoulders Stencil*, Google Fonts). UI text: a sturdy grotesque (e.g. *Space Grotesk*). Timers and heights: tabular stencil numbers |
| Motion | Weighty: things thunk, swing and settle. A crane sway when a piece is picked up, screen shake on a fumble (reduced with `prefers-reduced-motion`) |
| Sound | Clanks, crane winch whir, wooden thunk on landing, crumble and a whistle on a fumble, an air horn for topping out |

### Direction B (alternative): "Toy box"

Felt-tip doodles on a wooden toy table, chunky primary-coloured toy blocks for UI, crayon type. Friendlier, but closer to DoodleWhirl's hand-made feel. Only worth it if Direction A tests badly.

## Next step

Do a design pass before Phase 1 UI work: a mood board, the logo, the palette as tokens (light theme only at first: the game screen is always blueprint blue), and 2–3 key screens drawn properly. The wireframes in [screens.md](screens.md) are about layout only.
