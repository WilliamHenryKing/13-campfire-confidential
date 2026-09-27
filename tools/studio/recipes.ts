import type { Recipes } from "./kit/build";
import {
  bend,
  blend,
  box,
  capsule,
  carve,
  chain,
  cone,
  cylinder,
  displace,
  ellipsoid,
  extrude,
  fbm,
  lathe,
  type Mat,
  mat,
  mirrorX,
  mottle,
  move,
  type Node,
  paint,
  polygon2,
  radial,
  rng,
  rotate,
  scale,
  sphere,
  subtract,
  torus,
  union,
  type Vec3,
} from "./kit/sdf";

const pick = <T>(r: () => number, list: T[]) => list[Math.floor(r() * list.length)] as T;
const range = (r: () => number, a: number, b: number) => a + (b - a) * r();
void [bend, blend, box, capsule, carve, chain, cone, cylinder, displace, ellipsoid, extrude, fbm, lathe, mirrorX, mottle, move, paint, polygon2, radial, rotate, scale, sphere, subtract, torus, union];
type Build = (seed: number, index: number) => Node;
void (0 as unknown as Mat | Vec3 | Build);

// CAMPFIRE CONFIDENTIAL — camping props whose shadows tell stories. Every prop also renders a
// 12-angle silhouette atlas (the shadow a lamp casts on the tent wall at each rotation), the
// data the game uses to recognise sufficiently good shadow compositions.
const WARM = [0xc84b3c, 0x2f6f8a, 0xd9a441, 0x3f7a4f, 0x8a5a34, 0xe8e0cc];
const props: ((r: () => number) => Node)[] = [
  (r) => union(lathe([[0, 0], [0.12, 0], [0.14, 0.08], [0.12, 0.16], [0.05, 0.19], [0, 0.2]], 0, mat(pick(r, WARM), 0.35), true), capsule([0.1, 0.07, 0], [0.21, 0.16, 0], 0.025, 0.012, mat(pick(r, WARM), 0.35))),
  (r) => union(blend(0.03, move(box(0.1, 0.16, 0.08, 0.03, mat(0x5a3a22, 0.8)), [0, 0.08, 0]), move(box(0.1, 0.07, 0.26, 0.03, mat(0x5a3a22, 0.8)), [0, 0.035, 0.08])), move(box(0.11, 0.015, 0.27, 0.006, mat(0x2a2a2a, 0.7)), [0, 0.006, 0.08])),
  (r) => union(lathe([[0.045, 0.1], [0.045, 0], [0, 0]], 0.004, mat(pick(r, WARM), 0.35)), move(rotate(torus(0.03, 0.007, mat(pick(r, WARM), 0.35)), [Math.PI / 2, 0, 0]), [0.055, 0.05, 0])),
  (r) => displace(union(...Array.from({ length: 7 }, (_, i) => move(radial(rotate(move(ellipsoid(0.02, 0.008, 0.012, mat(0x6a4a2a, 0.8)), [0.025 - i * 0.002, 0, 0]), [0, 0, -0.4]), 8), [0, i * 0.018, 0]))), 0.002, 50, 2, 3),
  (r) => union(capsule([0, 0, 0], [0, 0.55, 0], 0.016, 0.018, mat(0x9a6a3a, 0.7)), move(box(0.14, 0.09, 0.025, 0.006, mat(pick(r, WARM), 0.4, 0.8)), [0.05, 0.5, 0])),
  (r) => union(move(cylinder(0.07, 0.02, 0.005, mat(0x2a2a2a, 0.4, 0.8)), [0, 0.01, 0]), move(cylinder(0.055, 0.14, 0.004, mat(0xffe2a8, 0.1)), [0, 0.09, 0]), move(cone(0.08, 0.02, 0.05, mat(0x2a2a2a, 0.4, 0.8)), [0, 0.19, 0]), move(rotate(torus(0.05, 0.006, mat(0x2a2a2a, 0.4, 0.8)), [Math.PI / 2, 0, 0]), [0, 0.25, 0])),
  (r) => lathe([[0, 0], [0.04, 0], [0.042, 0.16], [0.018, 0.2], [0.014, 0.26], [0, 0.26]], 0, mat(pick(r, [0x2f6f4a, 0x6a3a1a, 0x3a5a7a]), 0.1), true),
  (r) => union(capsule([0, 0, 0], [0.16, 0, 0], 0.006, 0.005, mat(0x9aa0a6, 0.3, 1)), move(ellipsoid(0.03, 0.008, 0.02, mat(0x9aa0a6, 0.3, 1)), [0.19, 0.002, 0])),
  (r) => union(lathe([[0.12, 0.14], [0.12, 0], [0, 0]], 0.006, mat(pick(r, WARM), 0.4)), capsule([0.12, 0.1, 0], [0.3, 0.12, 0], 0.01, 0.01, mat(0x2a2a2a, 0.6))),
  (r) => union(blend(0.02, move(box(0.12, 0.1, 0.04, 0.02, mat(pick(r, WARM), 0.8)), [0, 0.05, 0]), ...[0, 1, 2, 3].map((i) => capsule([-0.045 + i * 0.03, 0.1, 0], [-0.05 + i * 0.033, 0.19, 0], 0.012, 0.011, mat(pick(r, WARM), 0.8))), capsule([0.06, 0.05, 0], [0.1, 0.12, 0], 0.014, 0.012, mat(pick(r, WARM), 0.8)))),
  (r) => union(lathe([[0.16, 0.0], [0.16, 0.01], [0.08, 0.02], [0.07, 0.1], [0, 0.1]], 0.006, mat(pick(r, WARM), 0.85)), move(torus(0.075, 0.008, mat(0x3a2a20, 0.7)), [0, 0.03, 0])),
  (r) => blend(0.02, move(ellipsoid(0.16, 0.05, 0.03, mat(pick(r, [0x5a7a8a, 0x8a8a6a]), 0.4)), [0, 0.05, 0]), move(rotate(box(0.06, 0.07, 0.01, 0.004, mat(0x5a7a8a, 0.4)), [0, 0, 0.6]), [-0.17, 0.05, 0]), move(sphere(0.008, mat(0x1a1a1a, 0.3)), [0.12, 0.06, 0.028])),
  (r) => union(blend(0.03, move(sphere(0.07, mat(pick(r, [0x8a5a34, 0xc99a62]), 0.95)), [0, 0.07, 0]), move(sphere(0.05, mat(0x8a5a34, 0.95)), [0, 0.17, 0])), mirrorX(move(sphere(0.02, mat(0x8a5a34, 0.95)), [0.035, 0.21, 0])), mirrorX(capsule([0.06, 0.1, 0], [0.1, 0.05, 0.02], 0.02, 0.018, mat(0x8a5a34, 0.95)))),
];
const prop: Build = (seed, index) => props[index % props.length]?.(rng(seed)) as Node;
const campfire: Build = (seed) => {
  const r = rng(seed);
  const logs = union(...[0, 1, 2, 3].map((i) => move(rotate(cylinder(0.035, 0.45, 0.008, mat(0x4a3a2a, 0.9)), [0, i * 0.8, Math.PI / 2 - 0.5]), [0, 0.1, 0])));
  const flames = displace(move(cone(0.12, 0.01, 0.35, mat(0xffa040, 0.6)), [0, 0.3, 0]), 0.02, 12, 3, seed);
  const stones = radial(displace(move(ellipsoid(0.07, 0.05, 0.06, mat(0x6a6a66, 0.8)), [0.35, 0.03, 0]), 0.01, 20, 2, seed), 9);
  void r;
  return union(logs, flames, stones);
};

export const project = { id: "13-campfire-confidential", name: "CAMPFIRE CONFIDENTIAL", background: 0x2a2018 };
export const families: Recipes["families"] = [
  { id: "shadow-prop", count: 104, voxel: 0.0022, keep: 0.3, silhouette: true, build: prop },
  { id: "campfire", count: 6, voxel: 0.006, keep: 0.3, hero: true, build: campfire },
];
export const textures: Recipes["textures"] = [
  { id: "tent-canvas", ramp: [0xb8a476, 0xd9c79a, 0xe8dcb8], layers: [{ kind: "weave", count: 72 }, { kind: "fbm", scale: 6, weight: 0.5 }], roughness: [0.8, 0.95], normal: 1.6 },
  { id: "charred-wood", ramp: [0x0e0c0a, 0x2a2018, 0x4a3a2a], layers: [{ kind: "cells", count: 14, crack: true }, { kind: "fibres", scale: 24, stretch: 6, weight: 0.5 }], roughness: [0.7, 0.95], normal: 2.5 },
  { id: "tin-enamel", ramp: [0x7a2a1f, 0xc84b3c, 0xe8e0cc], layers: [{ kind: "cells", count: 60 }, { kind: "fbm", scale: 24, weight: 0.3 }], roughness: [0.25, 0.45], normal: 0.5 },
];
