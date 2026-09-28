# Fidelity pass: session report (CAMPFIRE CONFIDENTIAL)

Branch `cloud-v1`. Nothing was pushed to `main` and nothing was deployed. `bun run check`
(strict tsc, Biome, 54 unit tests, production build) and `bun run test:e2e` are green.

## Scores (mean of 8 criteria, 1–5; details in `AUDIT.md`)

| Bookmark | Baseline | Round 1 | Round 2 (current) |
| --- | --- | --- | --- |
| establishing | 1.3 | 2.9 | 3.4 |
| hero | 2.0 | 3.1 | 3.5 |
| closeup | 1.5 | 2.9 | 2.9 |
| grazing | 1.6 | 3.3 | 3.3 |
| phone-hero | 2.0 | 3.0 | 3.1 |
| **Overall** | **1.7** | **3.0** | **3.2** |

## Round 2 (after the real-GPU review)

1. **README media: NOT refreshed (stopped here).** `docs/readme/desktop.png`, `phone.png`
   and `preview.gif` still show the pre-fidelity look. The generator is ready and
   reproducible: `tools/visual/readme-media.mjs`. It stopped at frame 27 of about 85 when the
   session was told to stop (see "Where this session stopped").
2. **Tent volume.** The play camera and hero bookmark moved slightly off-axis, so guy lines,
   pegs and the roof's lit overhang (the roof now runs 0.45 m past each end wall) recede in
   perspective. The night sky is lifted to about 1/100 of the lit canvas so the pines
   silhouette against it, with fog in the sky's colour. The wall still dominates: the hero's
   wall centre measures 160/255, against 2 in the shadow umbra and 2 in the night.
3. **Load time.**
   - Where the driver offers `KHR_parallel_shader_compile` (Chrome on Windows/ANGLE, where
     the 5.2 s was measured), every scene shader compiles in parallel before the first
     frame.
   - Set dressing (stones, twigs, cones, pines) is built and compiled 1.2 s after the first
     frame, once the veil has faded.
   - All chipped-paint materials share one shader program.
   - On SwiftShader, which lacks the extension, `compileAsync` doubled the load (10.6 s
     against 4.6 s), so it is skipped there. SwiftShader timings are too noisy to prove the
     3 s target (4–12 s on the same build). **The real-GPU arrival time needs re-measuring
     on your machine.**
   - The tent-volume commit (`f0939b1`) also carries these load-time changes. A chained
     commit split failed, and I did not rewrite pushed history.
4. This report and `AUDIT.md` are updated.

Captures are in `docs/visual/captures/baseline/` and `docs/visual/captures/after/`. They
come from headless Chromium on SwiftShader: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device
(Subzero)), SwiftShader driver)`, logged in each set's `renderer.txt`. Reproduce with
`node tools/visual/capture.mjs <set>` against `bun run preview`.

## Assets

The shipped total is **7.8 MB**: textures and HDRI 6.2 MB, audio 1.6 MB. The budget is about
25 MB. All of it is CC0, and every file is in `assets.manifest.json` with source URL, author,
licence, retrieval date, original and output sha256, bytes and processing steps. The README
credits every source.

## What changed

- **Evidence.** A capture hook, `window.__VISUAL_TEST__`, available in dev and `?e2e` builds
  only (`ready`, `setBookmark`, `freeze`, `settle`, plus `story`, `between`, `tell`, `hud`
  and `renderer`). Five camera bookmarks: establishing, hero, closeup, grazing and
  phone-hero.
- **One lighting model.** The lantern is a real point light of about 80 cd at the rules' lamp
  position, so the judged shadow is unchanged. The spotlight, fill light and hemisphere light
  are gone. A CC0 night HDRI is both the environment and the background at true relative
  strength. The HDR composer runs GTAO, bloom (HDR threshold, mantle only), a scotopic grade,
  a single OutputPass (Neutral tone mapping and sRGB) and SMAA. Exposure is the only
  brightness control.
- **Materials.** Woven linen canvas at its real scale, with macro variation, a mud hem, a
  sagging screen and thin-fabric translucency, so the tent glows from outside. Props have
  chipped enamel and paint over bare steel, plus wood, leather and bark. The lantern has a
  glass globe, a glowing mantle and a blackened hood. The forest floor has two-scale breakup.
- **Set.** A closed wall tent with poles, guy lines and pegs, and instanced stones, twigs,
  cones and pines with scale, rotation and hue jitter.
- **Tiers and performance.** A low tier (no GTAO, 1024 shadow cube, pixel ratio 1.5) and an
  adaptive step that sheds GTAO, then pixel ratio, after about 2 s under 60 fps.
- **README.** New `desktop.png`, `phone.png` and `preview.gif` (disposal method 1 on every
  frame), from `node tools/visual/readme-media.mjs`, which is reproducible.

## Could not do / deliberately not done

- **Real-GPU check.** SwiftShader renders the high tier at about 2.7 s per frame here, so
  frame-rate targets (60 fps, adaptive thresholds) are untested on real hardware. The
  adaptive step exists for exactly that case.
- **Sourced models.** None were used. The props must stay inside the judged convex primitives,
  so refined procedural geometry won.
- **KTX2 and meshopt.** Textures ship as WebP 1K (allowed). No glTF is shipped, so meshopt has
  nothing to compress.
- **Lantern frame shadows.** The frame casts none, so it cannot stripe the screen.
- **Reference repository.** ODD TIDE was cloned read-only to `/home/user/01-odd-tide` after
  attaching it to the session. Only its approach was adapted (pipeline chain, glass shader,
  grade), in this repository's own code. No files or assets were copied: its textures were
  either not a fit or were re-downloaded at source (rough_linen, bark_brown_02).
- **Reply channel.** This cloud session cannot message other sessions, so this file is the
  report.

## Where this session stopped

I stopped on request (cloud credit exhausted), mid-way through the README media render.
**`bun run check` passes** (strict tsc, Biome, 54 tests, build). The e2e test last passed on
commit `a03dbd9` (round-2 code); only docs have changed since.

What is left, exactly:

1. **Regenerate the README media on the current build.** Run
   `bun run build && bun run preview`, then, in another shell,
   `node tools/visual/readme-media.mjs` (needs ffmpeg). On a real GPU it takes a minute or
   two; on SwiftShader it took about 15 min. Then verify:
   - `preview.gif` is ≤ 4 MB and 6–10 s long;
   - every graphic-control block has disposal method 1 (the previous config produced 1 on
     all frames);
   - the middle and last frames decode cleanly: `ffmpeg -i preview.gif -vf "select=eq(n\,40)"
     -vframes 1 mid.png`, and the same for the last frame.

   If the GIF is over 4 MB, lower `max_colors` in the script (128 → 96) or trim reveal
   frames. Commit the three files.
2. **Re-measure arrival time on a real GPU** (target ≤ 3 s). Parallel shader compile and
   deferred set dressing are in place, but SwiftShader cannot show the effect.
3. Optional, from the remaining-flaw list in `AUDIT.md`:
   - sag and seams on the side and roof panels;
   - a readable thermos lid;
   - contact scatter under the props.
