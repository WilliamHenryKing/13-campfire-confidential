import {
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  InstancedMesh,
  type Material,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import { LAMP } from "../game/shadow";
import { scanned } from "./materials";

// Instanced set dressing: stones, twigs and fallen cones on the forest floor, and a ring of
// pines fading into the dark. Every copy gets its own scale (±20 %), rotation and a slight hue
// shift, so no two match. Nothing here casts a shadow: the only shadows on the tent must be
// the props'.

interface Keepout {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Lumpy stone: a dodecahedron with its vertices pushed in and out. */
function stoneGeometry(r: () => number): BufferGeometry {
  const g = new DodecahedronGeometry(1, 1);
  const pos = g.getAttribute("position");
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 0.82 + 0.3 * Math.abs(Math.sin(v.x * 3.1 + v.y * 5.3 + v.z * 2.3 + r()));
    v.multiplyScalar(k);
    pos.setXYZ(i, v.x, v.y * 0.62, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function scatterInstances(
  geometry: BufferGeometry,
  material: Material,
  count: number,
  place: (i: number) => { p: Vector3; s: Vector3; q: Quaternion; tint: number } | null,
) {
  const mesh = new InstancedMesh(geometry, material, count);
  const m = new Matrix4();
  const c = new Color();
  let n = 0;
  for (let i = 0; i < count * 4 && n < count; i++) {
    const at = place(i);
    if (!at) continue;
    m.compose(at.p, at.q, at.s);
    mesh.setMatrixAt(n, m);
    mesh.setColorAt(n, c.setHSL(0.08, 0.12, 0.5 + at.tint * 0.5));
    n++;
  }
  mesh.count = n;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

export function buildScatter(tent: Keepout): Group {
  const group = new Group();
  const r = seeded(29);
  const up = new Vector3(0, 1, 0);

  const free = (x: number, z: number) => {
    const inTent = x > tent.minX && x < tent.maxX && z > tent.minZ && z < tent.maxZ;
    // Keep the path between lantern and tent clear, and the lantern's own spot.
    const inPlay = Math.abs(x) < 2.2 && z > tent.maxZ && z < LAMP[2] + 0.4;
    const atLamp = Math.hypot(x - LAMP[0], z - LAMP[2]) < 0.45;
    return !inTent && !inPlay && !atLamp;
  };
  const spot = (spread: number, near: number) => {
    const a = r() * Math.PI * 2;
    const d = near + r() * spread;
    return new Vector3(Math.cos(a) * d, 0, 1.5 + Math.sin(a) * d);
  };
  const jitter = (base: number) => base * (0.8 + r() * 0.4);
  const turn = () => new Quaternion().setFromAxisAngle(up, r() * Math.PI * 2);

  const stoneMat = scanned("forest_floor", "stone", "#8c877e", 0.35, 1.4);
  group.add(
    scatterInstances(stoneGeometry(r), stoneMat, 70, () => {
      const p = spot(9, 1.5);
      if (!free(p.x, p.z)) return null;
      const s = jitter(0.05 + r() * 0.1);
      p.y = s * 0.25;
      return { p, s: new Vector3(s, s, s * (0.8 + r() * 0.4)), q: turn(), tint: r() };
    }),
  );

  const twigMat = scanned("bark_brown_02", "twig", "#7a6450", 0.2, 0.6);
  const twig = new CylinderGeometry(0.008, 0.012, 1, 5);
  twig.rotateZ(Math.PI / 2);
  group.add(
    scatterInstances(twig, twigMat, 90, () => {
      const p = spot(9, 1.2);
      if (!free(p.x, p.z)) return null;
      const len = jitter(0.25 + r() * 0.35);
      p.y = 0.01;
      const q = turn().multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), r() * 0.2));
      return { p, s: new Vector3(len, jitter(1), jitter(1)), q, tint: r() };
    }),
  );

  const coneMat = scanned("bark_brown_02", "fallen-cone", "#6e5540", 0.15, 1);
  const cone = new ConeGeometry(0.035, 0.09, 9, 3);
  cone.rotateZ(Math.PI / 2);
  group.add(
    scatterInstances(cone, coneMat, 40, () => {
      const p = spot(8, 1.4);
      if (!free(p.x, p.z)) return null;
      const s = jitter(1);
      p.y = 0.03 * s;
      return { p, s: new Vector3(s, s, s), q: turn(), tint: r() };
    }),
  );

  // Pines at the edge of the lamplight, dissolving into the night.
  const trunkMat = scanned("bark_brown_02", "pine-trunk", "#6b5a4a", 1, 1);
  const needleMat = scanned("forest_floor", "pine-needles", "#2c3a2b", 0.6, 1.2);
  const trunk = new CylinderGeometry(0.12, 0.2, 1, 10);
  trunk.translate(0, 0.5, 0);
  const crown = new ConeGeometry(1, 1, 11, 4);
  crown.translate(0, 0.5, 0);
  const trees: { x: number; z: number; h: number }[] = [];
  for (let i = 0; i < 120 && trees.length < 34; i++) {
    const a = r() * Math.PI * 2;
    const d = 9 + r() * 12;
    const x = Math.cos(a) * d;
    const z = -1 + Math.sin(a) * d;
    if (z > 4 && Math.abs(x) < 13) continue; // keep every camera's sightline open
    trees.push({ x, z, h: jitter(9) });
  }
  let k = 0;
  group.add(
    scatterInstances(trunk, trunkMat, trees.length, () => {
      const t = trees[k++];
      if (!t) return null;
      const w = jitter(1);
      return { p: new Vector3(t.x, 0, t.z), s: new Vector3(w, t.h, w), q: turn(), tint: r() };
    }),
  );
  for (const tier of [0.25, 0.48, 0.7]) {
    k = 0;
    group.add(
      scatterInstances(crown, needleMat, trees.length, () => {
        const t = trees[k++];
        if (!t) return null;
        const w = jitter(2.4 * (1 - tier * 0.75));
        return {
          p: new Vector3(t.x, t.h * tier, t.z),
          s: new Vector3(w, t.h * 0.42, w),
          q: turn(),
          tint: r(),
        };
      }),
    );
  }
  return group;
}
