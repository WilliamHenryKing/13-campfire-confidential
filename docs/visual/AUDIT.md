# Visual audit: CAMPFIRE CONFIDENTIAL

Captured with `node tools/visual/capture.mjs <set>` against the production build (`?e2e` enables
the `window.__VISUAL_TEST__` hook), in headless Chromium on SwiftShader:
`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`. Every
bookmark poses story 1 with its known answer, so a figure is on the canvas.

Scale: 1 placeholder · 2 tech demo · 3 competent indie · 4 premium studio web piece · 5 reference.
Criteria: **L** light plausibility · **M** materials · **D** detail density · **E** environment
integration · **A** atmosphere and depth · **C** composition · **X** artefacts (5 = none) ·
**U** motion and UI integration.

## Baseline (`docs/visual/captures/baseline/`)

| Bookmark | L | M | D | E | A | C | X | U | Mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| establishing | 1 | 1 | 1 | 1 | 2 | 1 | 1 | 2 | **1.3** |
| hero | 2 | 1 | 1 | 2 | 2 | 3 | 2 | 3 | **2.0** |
| closeup | 2 | 1 | 1 | 1 | 2 | 2 | 1 | 2 | **1.5** |
| grazing | 2 | 1 | 1 | 1 | 2 | 2 | 2 | 2 | **1.6** |
| phone-hero | 2 | 1 | 1 | 2 | 2 | 3 | 2 | 3 | **2.0** |

What the captures show:

- **establishing:** the tent is only a front wall and two single-sided flaps. From outside it
  vanishes, so there is no glowing shadow play, only a black void with floating strings and a
  ridge pole. The ground is an unlit plane, and the dust reads as square sprites.
- **hero:** the shadow reads well. But the canvas is a flat orange card: the weave texture is
  invisible and the wall is lit evenly by a spotlight cone. The props are untextured clay,
  a hemisphere light and a fill point light prop up the ambience, and the grass is a flat
  dark plane.
- **closeup:** the thermos is two plain cylinders and the bowl is flat mint plastic with no rim
  or wear. The dust motes are hard-edged squares at this distance. The ground has no
  contact shadows or AO.
- **grazing:** there is no weave relief at a grazing angle, and the shadow edge is stair-stepped
  (a shadow-map texel pattern) rather than softened by the lantern's size. There is no seam
  stitching.
- **phone-hero:** the lantern is a plastic cone with an emissive cylinder, and its glow is a
  spot cone rather than a point source lighting the ground around it. The stones are
  identical clay blobs.

## Ranked fix list

1. **One lighting model.** Replace the spotlight, fill light and hemisphere light with the
   lantern as a real point light at the rules' lamp position (the judged projection is
   unchanged). Add a dim night HDRI as the environment that matches the sky, AgX once in the
   OutputPass, exposure as the only brightness control, and a scotopic grade instead of blue
   fill.
2. **Tent canvas.** Use a woven-fabric PBR set (colour, normal, roughness) at real scale,
   macro colour variation, seams, and thin-fabric translucency so the lantern glows through
   and the shadow play reads from outside. Close the tent (back, roof and sides) so the
   establishing shot has an object to look at.
3. **Props.** Give them PBR materials with enamel chips on rims, worn painted steel, wood grain
   on the spoons, leather on the boot and bark on the cone. Use lathe-profiled geometry with
   rolled rims and bevels inside the judged silhouettes.
4. **Lantern.** Build glass (physical, Fresnel), a blackened-steel frame and cap, and a glowing
   mantle that feeds bloom only through an HDR threshold.
5. **Ground.** Use a forest-floor PBR set with tiling breakup, instanced stones, twigs and
   pine cones with scale, rotation and hue jitter, and GTAO for contact.
6. **Post-processing.** Chain GTAO, thresholded bloom, SMAA and a single OutputPass, with a
   lower tier (no GTAO or bloom, smaller shadow map) for phones.
7. **Artefacts.** Make the dust round and soft, and soften the shadow-map edges (PCF radius
   plus a larger map on the point light).

## After (`docs/visual/captures/after/`)

Same bookmarks, the same pose and the same SwiftShader renderer, on the high tier.

| Bookmark | L | M | D | E | A | C | X | U | Mean | Before |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| establishing | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | **2.9** | 1.3 |
| hero | 4 | 3 | 2 | 3 | 4 | 3 | 3 | 3 | **3.1** | 2.0 |
| closeup | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | **2.9** | 1.5 |
| grazing | 3 | 4 | 3 | 3 | 3 | 3 | 4 | 3 | **3.3** | 1.6 |
| phone-hero | 4 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | **3.0** | 2.0 |

Overall mean: **1.7 → 3.0** (tech demo → competent indie).

### Round 2 (review on a real GPU: "the tent reads as a flat panel")

The play camera (and hero bookmark) moved slightly off-axis. The roof now overhangs both ends
and catches the lantern, the sky is lifted to about 1/100 of the lit canvas so the pines
silhouette against it, and the fog takes the sky's colour. Current captures:
`docs/visual/captures/after/`.

| Bookmark | L | M | D | E | A | C | X | U | Mean | Round 1 | Baseline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| establishing | 3 | 3 | 3 | 4 | 4 | 4 | 3 | 3 | **3.4** | 2.9 | 1.3 |
| hero | 4 | 3 | 3 | 4 | 4 | 4 | 3 | 3 | **3.5** | 3.1 | 2.0 |
| closeup | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | **2.9** | 2.9 | 1.5 |
| grazing | 3 | 4 | 3 | 3 | 3 | 3 | 4 | 3 | **3.3** | 3.3 | 1.6 |
| phone-hero | 4 | 3 | 2 | 3 | 4 | 3 | 3 | 3 | **3.1** | 3.0 | 2.0 |

Overall mean: **1.7 → 3.0 → 3.2**.

### Luminance targets for the hero (8-bit luma of the capture)

The game lives on one relationship: a lantern-warm screen against a dark night, with a shadow
darker than anything else. These values were measured on the round-2 `after/hero.png` and must hold
after any future grading change.

| Region | Target | Measured |
| --- | --- | --- |
| Wall centre, beside the figure | 130–175 | 160 |
| Wall edge (lamp falloff and vignette, far corner) | 45–110 | 53 |
| Shadow figure (umbra) | ≤ 8 | 2 |
| Night sky and forest | ≤ 12 | 2 |
| Ground between lantern and tent | 40–110 | 80 |

Exposure is the only brightness control (`EXPOSURE` in `src/scene/stage.ts`). The first
"after" pass at 0.95 measured a wall centre of 116, which read flat, so it was raised to 1.45.

### What changed

- **Light.** The lantern is a point light of about 80 cd at the rules' lamp position with a
  2048 cube shadow (PCF radius 3, a small-source penumbra). No rescue lights remain. The
  night-sky HDRI (CC0) is both the environment and the background at true relative strength
  (about 1/300 of the lit canvas). The HDR composer runs GTAO, bloom (threshold 9, mantle
  only, clamped), a scotopic grade, then OutputPass with Neutral tone mapping and sRGB once,
  then SMAA. Neutral was chosen over AgX because AgX drifted the warm canvas toward grey.
- **Tent.** A closed wall tent in scanned linen canvas at its real 0.27 m weave, with macro
  variation, a mud-splashed hem, a 2 cm sagging screen with folds under the eave, and
  thin-fabric translucency. From outside, the tent glows with the shadow play.
- **Props.** Chipped enamel and paint over bare steel, driven by a paint-survival mask from a
  scanned painted-metal texture, plus grained wood, leather and bark. Geometry is bevelled
  lathe and rounded boxes inside the judged silhouettes.
- **Lantern.** A painted fount, Fresnel glass globe, glowing mantle (the only emissive),
  blackened hood, frame, bail and a bark stump.
- **Ground and set.** A forest floor with two-scale breakup, instanced stones, twigs, cones
  and pines with ±20 % scale, rotation and hue jitter, soft round dust, and exponential
  aerial fog in the sky's colour.
- **Tiers.** A low tier for phones and small screens (no GTAO, 1024 cube, pixel ratio 1.5).
  Adaptive quality sheds GTAO, then pixel ratio, after about 2 s of slower-than-60 fps frames.

### Remaining flaws (three most visible per bookmark)

- **establishing:** (1) the side and roof panels are flat, without the sag and seams the
  screen has; (2) the tent has no door, ties or stakes loops, so it reads as new; (3) the
  log's end grain reads dark, like a pipe.
- **hero:** (1) the canvas reads smooth at this distance, because the weave only appears at
  grazing angles; (2) the strings are thin, aliased lines; (3) the ground outside the lamp pool
  falls to flat black.
- **closeup:** (1) the thermos lid is a dark, unreadable steel cap in back light; (2) the
  bowl's cream rim is the hottest thing in frame; (3) there is little floor detail directly
  under the props (no contact scatter).
- **grazing:** (1) the seams are flat strips with no stitching or thickness; (2) the
  penumbra has a uniform width, with no contact hardening near the wall; (3) the tent pole
  at the edge is a plain cylinder.
- **phone-hero:** (1) the props are tiny on a phone, so the figure carries the frame alone;
  (2) the stump top reads flat; (3) the mantle bloom is small, so the lantern reads as a
  point rather than a glowing globe.

### Not done

- **Sourced models.** None were used. The props must match the judged convex primitives, so
  refined procedural geometry won; nothing in the CC0 libraries matched these props closely
  enough.
- **KTX2 and meshopt.** Textures ship as WebP 1K. No glTF is shipped, so meshopt has nothing
  to compress.
- **Lantern frame shadows.** The frame casts none, by design, so it cannot stripe the screen.
