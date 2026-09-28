import {
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  type MeshStandardMaterial,
  PlaneGeometry as Plane,
  PlaneGeometry,
} from "three";
import { WALL } from "../game/shadow";
import { forestFloor, scanned, tentCanvas } from "./materials";
import { buildScatter } from "./scatter";

// A canvas wall tent. Its front end wall is the screen at z = 0; the tent body runs back into
// the forest. Every canvas panel is double-sided, thin-fabric translucent and receives the
// lantern's shadow, so seen from outside the whole tent glows with the shadow play.

const TENT_W = WALL.maxX - WALL.minX + 0.6;
const EAVE = 3.7;
const PEAK = 4.9;
const DEPTH = 4.6;
/** Linen weave repeats every 0.27 m in the scan. */
const WEAVE = 0.27;

function panel(points: number[], uvs: number[], material: MeshStandardMaterial) {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(points, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  const m = new Mesh(g, material);
  m.receiveShadow = true;
  return m;
}

/**
 * The screen: a finely divided panel whose canvas sags a couple of centimetres between the
 * poles and folds under the eave, so the lamp picks out real relief. The rules still judge the
 * plane z = 0; a 2 cm sag moves a shadow edge by well under a millimetre-scale grid cell.
 */
function screenPanel(z: number, material: MeshStandardMaterial) {
  const h = TENT_W / 2;
  const g = new Plane(TENT_W, EAVE, 148, 74);
  g.translate(0, EAVE / 2, 0);
  const pos = g.getAttribute("position");
  const uv = g.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const across = Math.abs(Math.sin((Math.PI * (x + h)) / (TENT_W / 2)));
    const sag = -0.02 * across * Math.sin((Math.PI * y) / EAVE);
    const folds = 0.006 * Math.sin(x * 7.3 + y * 1.1) * Math.max(0, (y - EAVE * 0.6) / EAVE);
    pos.setZ(i, z + sag + folds);
    uv.setXY(i, (x + h) / WEAVE, y / WEAVE);
  }
  g.computeVertexNormals();
  const m = new Mesh(g, material);
  m.receiveShadow = true;
  return m;
}

/** A pentagonal end wall (rectangle plus gable) in the plane z. */
function endWall(z: number, material: MeshStandardMaterial, gableMaterial = material) {
  const h = TENT_W / 2;
  const u = (x: number) => (x + h) / WEAVE;
  const v = (y: number) => y / WEAVE;
  const g = new Group();
  g.add(
    screenPanel(z, material),
    panel(
      [-h, EAVE, z, h, EAVE, z, 0, PEAK, z],
      [u(-h), v(EAVE), u(h), v(EAVE), u(0), v(PEAK)],
      gableMaterial,
    ),
  );
  return g;
}

function quad(a: number[], b: number[], c: number[], d: number[], material: MeshStandardMaterial) {
  const len = (p: number[], q: number[]) =>
    Math.hypot((p[0] ?? 0) - (q[0] ?? 0), (p[1] ?? 0) - (q[1] ?? 0), (p[2] ?? 0) - (q[2] ?? 0));
  const w = len(a, b) / WEAVE;
  const hgt = len(a, d) / WEAVE;
  return panel(
    [...a, ...b, ...c, ...a, ...c, ...d],
    [0, 0, w, 0, w, hgt, 0, 0, w, hgt, 0, hgt],
    material,
  );
}

function pole(
  from: [number, number, number],
  to: [number, number, number],
  r: number,
  mat: MeshStandardMaterial,
) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dy, dz);
  const m = new Mesh(new CylinderGeometry(r, r * 1.08, length, 12), mat);
  m.position.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2);
  m.lookAt(to[0], to[1], to[2]);
  m.rotateX(Math.PI / 2);
  m.castShadow = false;
  m.receiveShadow = true;
  return m;
}

export function buildCampsite(): Group {
  const site = new Group();
  const canvas = tentCanvas(1, 1);
  const upper = tentCanvas(1, 1, 1, false);
  const h = TENT_W / 2;

  // Front end wall: the screen. It never casts, so it cannot shadow itself.
  site.add(endWall(0, canvas, upper));
  site.add(endWall(-DEPTH, canvas, upper));
  for (const side of [-1, 1]) {
    const x = side * h;
    site.add(quad([x, 0, 0], [x, 0, -DEPTH], [x, EAVE, -DEPTH], [x, EAVE, 0], canvas));
    site.add(quad([x, EAVE, 0], [x, EAVE, -DEPTH], [0, PEAK, -DEPTH], [0, PEAK, 0], upper));
  }

  // Seams and a hem strip: the same canvas, doubled, catching light a little differently.
  const seamCanvas = tentCanvas(1, 1, 0.82, false);
  for (const x of [-h / 2, h / 2]) {
    site.add(
      quad(
        [x - 0.025, 0.12, 0.003],
        [x + 0.025, 0.12, 0.003],
        [x + 0.025, EAVE, 0.003],
        [x - 0.025, EAVE, 0.003],
        seamCanvas,
      ),
    );
  }
  site.add(quad([-h, 0, 0.003], [h, 0, 0.003], [h, 0.12, 0.003], [-h, 0.12, 0.003], seamCanvas));

  const wood = scanned("fine_grained_wood", "pole-wood", "#9c7652", 1, 0.8);
  for (const x of [-h, h]) {
    site.add(pole([x, 0, 0.06], [x, EAVE + 0.1, 0.06], 0.045, wood));
    site.add(pole([x, 0, -DEPTH - 0.06], [x, EAVE + 0.1, -DEPTH - 0.06], 0.045, wood));
  }
  // The centre poles stand inside the tent, behind the screen.
  site.add(pole([0, 0, -0.12], [0, PEAK + 0.05, -0.12], 0.05, wood));
  site.add(pole([0, 0, -DEPTH + 0.12], [0, PEAK + 0.05, -DEPTH + 0.12], 0.05, wood));
  site.add(pole([0, PEAK + 0.04, 0.3], [0, PEAK + 0.04, -DEPTH - 0.3], 0.045, wood));

  // Guy lines from the eaves to pegs in the ground.
  const rope = scanned("rough_linen", "guy-rope", "#bba98a", 4, 0.5);
  for (const side of [-1, 1])
    for (const z of [0.05, -DEPTH / 2, -DEPTH - 0.05]) {
      const from: [number, number, number] = [side * h, EAVE, z];
      const to: [number, number, number] = [
        side * (h + 2.1),
        0.02,
        z + (z > 0 ? 0.6 : z < -DEPTH ? -0.6 : 0),
      ];
      site.add(pole(from, to, 0.006, rope));
      site.add(pole([to[0], 0, to[2]], [to[0], 0.12, to[2]], 0.012, wood));
    }

  const ground = new Mesh(new PlaneGeometry(60, 60), forestFloor(60 / 2.14));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  site.add(ground);

  // A log bench behind the lantern, in the warm light and out of the shadow play.
  const log = new Mesh(new CylinderGeometry(0.17, 0.19, 1.8, 24, 1), [
    scanned("bark_brown_02", "log-bark", "#8f7d69", 1.2),
    scanned("fine_grained_wood", "log-end", "#c29a6e", 0.5),
    scanned("fine_grained_wood", "log-end", "#c29a6e", 0.5),
  ]);
  log.rotation.z = Math.PI / 2;
  log.rotation.y = 0.35;
  log.position.set(-1.8, 0.18, 5.6);
  log.receiveShadow = true;
  site.add(log);

  site.add(buildScatter({ minX: -h - 0.1, maxX: h + 0.1, minZ: -DEPTH - 0.1, maxZ: 0.1 }));
  return site;
}
