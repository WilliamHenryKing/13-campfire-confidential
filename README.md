# CAMPFIRE CONFIDENTIAL

**Status: v1 complete.** CAMPFIRE CONFIDENTIAL is a short shadow-composition game. A camp lantern throws the shadows of hanging camp props onto a tent wall. Four campers each report a strange sighting: a mushroom, a rabbit, a snail and a rocket. You arrange two to four props until their combined shadow tells the story. The game compares shapes fairly: your figure is centred and scaled before it is compared with the camper's sketch, so it counts anywhere on the wall, at any size and mirrored, and small slips still pass. Live feedback and two levels of hints help you there. The loop runs title → four stories → a painted tableau of your own shadows → replay. Not deployed.

## How to play

- **Pick a prop**: tap or click it, use the chips, or press `1`–`4`.
- **Move its shadow**: drag the prop, or use the arrow buttons or arrow keys.
- **Resize the shadow**: scroll, pinch, or use **Bigger** / **Smaller** (`+` / `−`). Bigger brings the prop toward the lamp.
- **Change its outline**: use **Turn** (`Q` / `E`) to swing the prop round, and **Tilt** (`Z` / `X`) to lean it.
- **Hint** (`H`): the first press gives plain advice naming one prop ("Move the kettle's shadow up…"). The second press traces the sketch in chalk over your figure on the tent.
- **Reset** (`R`) puts the props back where they started.
- When the likeness meter reads *That's it!* and you let go, the story is told.

Controls are labelled buttons with visible focus. The game honours `prefers-reduced-motion` (no flicker, no tweened tableau).

## How it works

- `src/game/`: pure rules, unit-tested in `tests/`. Each prop is a union of convex solids. These are projected from the lamp onto the wall plane and rasterised into a mask (`shadow.ts`). A figure is normalised by its centroid and √area, and compared with the target by overlap, both straight and mirrored (`compare.ts`). Every prop must also carry a fair share of the figure. Per-prop advice (`hints.ts`), chapters with per-figure pass marks (`chapters.ts`) and the game reducer (`state.ts`) complete the rules.
- `src/scene/`: three.js. The spotlight sits exactly at the rules' lamp position, so the rendered shadow map is the shadow being judged. The scene also holds the procedural canvas tent, clay-style props on strings, pointer input, and the wall overlay for the hint trace and the tableau.
- `src/ui/`: React HUD (story card, sketch, meter, controls, cards). `src/main.tsx` wires one store to both.

## Credits

All geometry, textures and type are made in code or use system fonts. Audio lives in `public/audio/` (about 1.6 MB), re-encoded to 64 kbps MP3 and trimmed or level-matched. No other change was made. Each licence was checked on the source page on 2026-09-27.

| File | Source | Author | Licence |
| --- | --- | --- | --- |
| `music-meadow-thoughts.mp3` | [Meadow Thoughts](https://opengameart.org/content/meadow-thoughts) (solo harp) | Écrivain | CC0 |
| `amb-crickets.mp3` | [Crickets Ambient Noise – loopable](https://opengameart.org/content/crickets-ambient-noise-loopable) | Wolfgang_ | CC0 |
| `amb-fire.mp3` | [Fireplace Sound loop](https://opengameart.org/content/fireplace-sound-loop) | PagDev | CC0 |
| `sfx-grab`, `sfx-turn`, `sfx-tilt`, `sfx-pick-metal`, `sfx-pick-leather`, `sfx-reset`, `sfx-page`, `sfx-lamp`, `sfx-paint` | [RPG Audio](https://kenney.nl/assets/rpg-audio) | Kenney (kenney.nl) | CC0 |
| `sfx-tick`, `sfx-depth`, `sfx-hint`, `sfx-trace`, `sfx-close` | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | Kenney (kenney.nl) | CC0 |
| `sfx-settle`, `sfx-pick-wood`, `sfx-pick-enamel` | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | Kenney (kenney.nl) | CC0 |
| `sfx-click` | [UI Audio](https://kenney.nl/assets/ui-audio) | Kenney (kenney.nl) | CC0 |
| `sfx-told`, `sfx-finale` | [Music Jingles](https://kenney.nl/assets/music-jingles) (Pizzicato 10, Steel 10) | Kenney (kenney.nl) | CC0 |

CC0 needs no attribution. The credits are given anyway.

## Development

```sh
bun install --frozen-lockfile
bun run dev      # http://127.0.0.1:4523/
bun run check    # tsc, Biome, bun test, production build into dist/
bun run preview  # http://127.0.0.1:4623/
```

`development/` holds the earlier tooling smoke harness (`bun run dev:smoke`). It is not part of the game.
