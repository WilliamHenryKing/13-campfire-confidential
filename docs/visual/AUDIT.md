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
