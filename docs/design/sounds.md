# Sounds

Sound makes the game feel like a table, not a web page. Every sound tells the player something happened. The only music is a looping tune on the home page (below); there is no ambience. Code: `apps/web/src/app/features/sound/`. Files: `apps/web/public/sounds/`.

## What plays, and when

| Sound | When | Who hears it | Group | File (source) |
|---|---|---|---|---|
| Deck shuffle | The choosing phase starts (with the riffle animation) | Everyone | Cards & turns | `card-shuffle` (Casino Audio `card-shuffle`, trimmed to 1.1 s) |
| Card dealt | Each card lands on the table | Everyone | Cards & turns | `card-deal-1…4` (Casino Audio `card-slide-1…4`, picked at random) |
| Card flip | Each card turns face up | The drawer | Cards & turns | `card-flip` (Casino Audio `card-place-1`) |
| Card picked | The drawer picks a card | The drawer | Cards & turns | `card-pick` (Casino Audio `card-shove-1`) |
| Your turn | A turn starts and you are the drawer | The drawer | Cards & turns | `your-turn` (Music Jingles `PIZZI00`) |
| Turn over | The word is revealed | Everyone | Cards & turns | `time-up` (Interface Sounds `bong_001`) |
| Match results | The results screen opens without the podium show (reduced motion) | Everyone | Cards & turns | `match-results` (Music Jingles `PIZZI07`) |
| Podium ceremony | The results' show (screens.md §6), in time with it: the podium scribbled on, each landing on a step, a drumroll, a cymbal crash and a fanfare as the winner lands, a pop per crowd member and per award sticker, a boing when you poke someone | Everyone who watched the match end (not on a late join) | Cards & turns | `podium-scribble`, `podium-thump`, `drumroll`, `cymbal-crash`, `winner-fanfare`, `sticker-pop`, `poke-boing` (synthesised for the game, 2026-10-08: the prototype's Web Audio recipes rendered to WAV and encoded with ffmpeg. Filtered noise for the pencil, roll and cymbal; a falling sine for the thump; a triangle arpeggio for the fanfare; rising sweeps for the pop and boing) |
| Correct guess | Your guess is right | You | Guesses | `guess-correct` (Interface Sounds `confirmation_002`) |
| Someone solved | Another player gets it | Everyone else | Guesses | `guess-solved` (Interface Sounds `confirmation_001`), quieter |
| Close guess | Your guess is close | You | Guesses | `guess-close` (Interface Sounds `question_002`) |
| Hint | A letter is revealed | Everyone | Guesses | `hint` (Interface Sounds `glass_002`) |
| Pencil scribble | While a line is being drawn, as a loop whose level and pitch follow the line's speed. It fades out when the pencil stops or lifts. The eraser plays it slower and lower | Everyone (it follows the stroke model, so guessers hear the drawer) | Drawing | `pencil-loop.wav` ([Pencil or Marker writing, khenshom](https://freesound.org/people/khenshom/sounds/530190/), CC0: 3 s from 45.5 s, evened out, with a 0.5 s crossfade so it loops seamlessly). **Very faint** (0.12 of the group volume) |
| Paint bucket | A fill lands | Everyone | Drawing | `fill-glug-1`, `fill-glug-2` ([Cartoon Glugging, MylieJoeMoss1996](https://freesound.org/people/MylieJoeMoss1996/sounds/741576/), CC0: two "glug-glug" cuts, picked at random with a slight pitch change) |
| Clock tick | Each of the last 10 seconds of drawing (not while paused) | Everyone | Clock ticking | `clock-tick` (Interface Sounds `tick_004`), alternating pitch for tick/tock, quiet and getting a little louder |
| Message | Someone else chats or guesses wrong | Everyone else | Chat & players | `chat` (Interface Sounds `pluck_001`) |
| Player joined / left | The player list gains or loses someone | Everyone | Chat & players | `player-join` (`drop_002`), `player-leave` (`back_002`) |
| Paper crumple / kick | The host closes the room: it's scrunched into a ball, then the ball is kicked away | The host | Chat & players | `paper-crumple`, `paper-kick` (synthesised for the game: crackle bursts through resonant filters over a rustle; a thump, a papery tap and a whoosh. Not auditioned yet) |

Rules:

- **Catching up is silent.** A snapshot (joining, reconnecting) never plays sounds.
- **Bursts are thinned.** Chat, joins and "someone solved" play at most once per 120–200 ms.
- **No sound before the first click.** Browsers block audio until the player interacts with the page. The audio context starts on the first pointer or key press, and sounds asked for before that are dropped (they would be stale).
- **Reduced motion** skips the card intro, so its shuffle and deal sounds are skipped too.
- **Skipping the podium show** (a tap, or Skip) cuts off what it was playing, the drumroll too (`playSound` returns a stop function).

## Settings

The 🔊 button sits in the room header and the lobby header. It opens a panel with:

- **Mute all**, and a main volume slider.
- Six groups (the sixth, **Music**, starts at 50%), each with an on/off checkbox and a volume slider: **Cards & turns**, **Guesses**, **Drawing**, **Clock ticking** (starts at 60%, since ticking divides players), **Chat & players** (starts at 70%).

Letting go of a slider plays a sample of that group. The settings are saved in `localStorage` (`pictiotheme.sound`).

To swap a clip, put the MP3 in `public/sounds/` and change the file name in `sound-catalog.ts`. Each sound's relative loudness lives there too.

## Home page music

"Flowerbed Fields" by Zane Little (`public/sounds/flowerbed-fields.ogg`, plus a 128 kbps `.mp3` for browsers without Ogg). It's an `<audio>` element (`home-music.ts`, mounted by `HomeMusic.tsx` on `/`), started on the first click or key press, looping, paused while the tab is hidden, and controlled by the Music group in a 🔊 button in the page's top corner. It **carries on into the waiting room** (and back home): leaving a page while it plays leaves its position in sessionStorage, and the next page picks it up there (`WaitingRoomMusic`, only if it was playing). If the browser won't start it without a click on the new page, it waits for one. It fades out when the match starts. **Check the license** (credited in `CREDITS.txt`; not CC0 as far as we know).

## Sources and licenses

Everything shipped today is **CC0**: the two paper sounds we made ourselves, three [Kenney](https://kenney.nl) packs ([Casino Audio](https://kenney.nl/assets/casino-audio), [Interface Sounds](https://kenney.nl/assets/interface-sounds), [Music Jingles](https://kenney.nl/assets/music-jingles)) and two Freesound recordings (the pencil and the glug, above). No credit is required, but it is given in `public/sounds/CREDITS.txt`. One-shots are mono 96 kbps MP3. The pencil loop is a 22 kHz mono WAV (132 KB), because MP3 adds silence at the start that would click on every loop. About 280 KB in total.

### Alternatives (researched 2026-10-04, not auditioned)

Licenses: CC0 and Mixkit/Pixabay need no credit. **CC-BY needs credit**. Pixabay files can't be redistributed on their own (shipping them inside the game is fine).

| Sound | Alternatives |
|---|---|
| Shuffle | [Riffle Card Shuffle, Kodack](https://freesound.org/people/Kodack/sounds/256508/) (CC0, trim one riffle); [Playing card sounds, BMacZero](https://opengameart.org/content/playing-card-sounds) (CC0); Mixkit "Thin metal card deck shuffle" ([casino](https://mixkit.co/free-sound-effects/casino/)) |
| Card dealt | [Playing Card Deal Variation 3, el_boss](https://freesound.org/people/el_boss/sounds/571575/) (CC0, more variations in the pack); Mixkit "Poker card placement" |
| Card flip | [Card Flip, f4ngy](https://freesound.org/people/f4ngy/sounds/240776/) (**CC-BY**); Mixkit "Poker card flick"; [flipCard](https://pixabay.com/sound-effects/film-special-effects-flipcard-91468/) (Pixabay) |
| Correct guess | [Quiz Gameshow Correct Ding 04, craigscottuk](https://freesound.org/people/craigscottuk/sounds/644949/) (CC0; its pack has ~12 matching pings, so "someone solved" could come from the same family); [Correct Bell, Fupicat](https://freesound.org/people/Fupicat/sounds/538147/) (CC0) |
| Close guess | Nothing made for it. Options: [Bloop, floraphonic](https://pixabay.com/sound-effects/film-special-effects-bloop-1-184019/) (Pixabay), Mixkit "Interface hint notification", or synthesise one (jsfxr) |
| Clock tick | [clock_tickC1/C2, Mohagged](https://freesound.org/people/Mohagged/sounds/810937/) (CC0, a real tick/tock pair: **the best upgrade**); [Tick Tock Dry, GammaGool](https://freesound.org/people/GammaGool/sounds/759501/) (CC0) |
| Turn over | [Zen Gong](https://pixabay.com/sound-effects/film-special-effects-zen-gong-199844/) (Pixabay, soft); [Small Gong Soft Hit](https://pixabay.com/sound-effects/musical-small-gong-soft-hit-raw-102337/) (Pixabay) |
| Your turn | Mixkit "Happy bells notification"; [Notification Bell, DRAGON-STUDIO](https://pixabay.com/sound-effects/film-special-effects-notification-bell-sound-376888/) (Pixabay) |
| Results | [Fanfare 2 RPG, colorsCrimsonTears](https://freesound.org/people/colorsCrimsonTears/sounds/580310/) (CC0); [Victory Fanfare Short, cynicmusic](https://opengameart.org/content/victory-fanfare-short) (CC0) |
| Joined / left | [Whoosh, qubodup](https://freesound.org/people/qubodup/sounds/60013/) (CC0, reversed for "left") |
| Chat | [bubbles pop, farfadet46](https://opengameart.org/content/bubbles-pop) (CC0) |
| Whole sets | [Dustyroom Free Casual Game Sounds](https://dustyroom.com/free-casual-game-sounds/) (CC0, 50 sounds in one style, including time warnings); [Card Game sounds, HaelDB](https://opengameart.org/content/card-game-sounds) (CC0) |

## Ideas not built yet

- Pencil sounds on the avatar and deck-cover pads (they have their own stroke models; `watchDrawing` would work on them too).
- Other pencil sources if this one doesn't fit: [Pencil #1, Joseph Sardin](https://bigsoundbank.com/detail-0221-pencil.html) (CC0), [Pencil Scratch 1, OwlStorm](https://freesound.org/people/OwlStorm/sounds/320151/) (CC0). Other glugs: [glug_glug_glug, noisymichael](https://freesound.org/people/noisymichael/sounds/661609/) (CC0).
- **Leaderboard overtake** "whoosh" when your rank rises.
- **Last 3 seconds** with a firmer tick.
