# Doodle Tower — Documentation

> Picking up the work? Start with [planning/status.md](planning/status.md).

Doodle Tower is a team game for PC and tablet browsers: **Pictionary meets Tricky Towers**. Two crews race to build a tower past a height line. Every block is a drawing: a crew's drawer draws a word, and whoever guesses it first turns the drawing into a physics piece. They either keep it for their tower or curse it and send it to the other crew's. Opponents can **steal** a drawing by guessing it first.

It lives in the PictioTheme (DoodleWhirl!) monorepo and shares its server, database, decks, avatars and the player profile; it's the worked example in [adding-a-game.md](../technical/adding-a-game.md). It has **its own domain, its own frontend and its own visual identity**: nothing should look like DoodleWhirl.

## How these docs are organized

| Section | What's in it | Read it if you want to… |
|---|---|---|
| **[product/](product/)** | What we're building and why | |
| ↳ [vision.md](product/vision.md) | Pitch, core loop, why it's fun, glossary | get the big picture |
| ↳ [game-rules.md](product/game-rules.md) | Teams, rounds, guessing, stealing, keep/curse, placing, fumbles, winning | implement or balance gameplay |
| ↳ [word-pool.md](product/word-pool.md) | Which decks and cards are used, and why | work on word selection |
| **[design/](design/)** | How it looks | |
| ↳ [visual-identity.md](design/visual-identity.md) | The look, typography, colour, sound, what to avoid | design or style anything |
| ↳ [screens.md](design/screens.md) | Wireframes for every screen | build the UI |
| **[technical/](technical/)** | How we build it | |
| ↳ [architecture.md](technical/architecture.md) | How Doodle Tower fits the monorepo, packages, the server module, the domain | set up the project |
| ↳ [piece-pipeline.md](technical/piece-pipeline.md) | Drawing → filled silhouette → normalized polygon → collider | build pieces |
| ↳ [physics.md](technical/physics.md) | Rapier, server-authoritative simulation, placement, height and stability, tuning values | build towers |
| ↳ [realtime-protocol.md](technical/realtime-protocol.md) | WebSocket messages | wire up multiplayer |
| ↳ [data-model.md](technical/data-model.md) | New tables and what's reused | write migrations |
| **[planning/](planning/)** | When and in what order | |
| ↳ [roadmap.md](planning/roadmap.md) | Phases, starting with a single-player physics sandbox | plan the work |
| ↳ [open-questions.md](planning/open-questions.md) | Decisions not made yet | help make decisions |
| ↳ [test-mode.md](planning/test-mode.md) | Trying the powers alone: bots, a "guess" button, a checklist | test curses and spells |
| ↳ [status.md](planning/status.md) | **Current state and next tasks** | pick up the work |

The DoodleWhirl docs ([../README.md](../README.md)) still apply wherever these don't say otherwise: the locked stack, the backend and frontend guidelines, the security rules, deployment.

## Decisions so far (2026-10-19)

| Topic | Decision |
|---|---|
| Repo | Same monorepo as DoodleWhirl. Separate web app and visual identity |
| Domain | Its own domain |
| Devices | PC and tablet only. Phones get a "play on a bigger screen" gate |
| Sent pieces | The **receiving** crew places them |
| Winning | Race to a height line. A piece falling off costs a timeout (a "fumble") |
| Drawer | A new drawer every round |
| Shapes | Enclosed areas are **filled** |
| Words | **Easy cards only**, from an allowlist of decks that draw well as objects |
