import {
  type BufferGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  type MeshStandardMaterial,
  SphereGeometry,
  Vector2,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { PROPS } from "../game/props";
import { TILT_STEP, TURN_STEP } from "../game/shadow";
import type { Material, Placement, Primitive, PropKind } from "../game/types";
import { chippedPaint, scanned, steel } from "./materials";

// Meshes built from the primitives the rules project. Edges are bevelled and rims rolled
// inside each primitive's outline, so the rendered shadow still matches the judged one; the
// surfaces are sourced scans (enamel chipped to bare steel, grain, leather, bark).

function material(key: Material, seed: number): MeshStandardMaterial {
  // Each prop gets its own instances with a slight tint shift: no two thermoses match.
  const j = (range: number) => (((seed * 9301 + 49297) % 233280) / 233280 - 0.5) * range;
  let m: MeshStandardMaterial;
  switch (key) {
    case "enamel":
      m = chippedPaint("#3d6c90", "enamel-blue", "#1e1d1b", 0.22);
      break;
    case "cream":
      m = chippedPaint("#ebe1cb", "enamel-cream", "#262422", 0.25);
      break;
    case "red":
      m = chippedPaint("#a3402b", "thermos-red", "#2b2a28", 0.33);
      break;
    case "steel":
      m = steel("prop-steel", "#9aa0a4", 0.38);
      break;
    case "wood":
      m = scanned("fine_grained_wood", "spoon-wood", "#e6c298", 0.35, 0.7);
      break;
    case "leather":
      m = scanned("brown_leather", "boot-leather", "#b88461", 0.6, 1);
      break;
    case "rubber":
      m = scanned("brown_leather", "rubber", "#3b3531", 1.2, 0.6);
      break;
    case "cone":
      m = scanned("bark_brown_02", "pinecone", "#9a714f", 0.25, 1.4);
      m.flatShading = true;
      break;
  }
  m.color.offsetHSL(j(0.02), j(0.06), j(0.06));
  return m;
}

/** A cylinder or truncated cone with its rims rounded inward. */
function bevelledCylinder(rTop: number, rBottom: number, height: number): BufferGeometry {
  const b = Math.min(0.006, height * 0.2, Math.min(rTop, rBottom) * 0.3);
  const h = height / 2;
  const pts: [number, number][] = [
    [0, -h],
    [rBottom - b, -h],
    [rBottom - b * 0.3, -h + b * 0.3],
    [rBottom, -h + b],
    [rTop, h - b],
    [rTop - b * 0.3, h - b * 0.3],
    [rTop - b, h],
    [0, h],
  ];
  return new LatheGeometry(
    pts.map(([r, y]) => new Vector2(r, y)),
    40,
  );
}

function geometry(p: Primitive): BufferGeometry {
  switch (p.kind) {
    case "box": {
      const radius = Math.min(0.012, Math.min(...p.size) * 0.3);
      return new RoundedBoxGeometry(p.size[0], p.size[1], p.size[2], 3, radius);
    }
    case "cyl":
      if (p.rTop === 0 || p.rBottom === 0 || p.mat === "cone")
        return new CylinderGeometry(p.rTop, p.rBottom, p.height, p.mat === "cone" ? 11 : 32, 4);
      return bevelledCylinder(p.rTop, p.rBottom, p.height);
    case "ellipsoid":
      return new SphereGeometry(p.radius, p.mat === "cone" ? 11 : 40, p.mat === "cone" ? 9 : 28);
    case "dome":
      return new SphereGeometry(p.radius, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  }
}

export interface PropView {
  group: Group;
  meshes: Mesh[];
}

export function buildProp(kind: PropKind): PropView {
  const group = new Group();
  group.name = kind;
  const meshes: Mesh[] = [];
  for (const prim of PROPS[kind].primitives) {
    // Each prop gets its own material instances so selection can glow one prop only.
    const mesh = new Mesh(geometry(prim), material(prim.mat, kind.length * 7 + meshes.length * 13));
    mesh.position.set(...prim.pos);
    if (prim.kind === "ellipsoid") mesh.scale.set(...prim.scale);
    if (prim.kind === "dome") mesh.scale.set(1, prim.scaleY, 1);
    if ("rot" in prim && prim.rot) mesh.rotation.set(...prim.rot);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    meshes.push(mesh);
  }
  return { group, meshes };
}

export function placeProp(view: PropView, at: Placement) {
  view.group.position.set(at.x, at.y, at.z);
  view.group.rotation.set(0, at.turn * TURN_STEP, at.tilt * TILT_STEP, "ZYX");
}

export function highlightProp(view: PropView, on: boolean) {
  for (const mesh of view.meshes) {
    const m = mesh.material as MeshStandardMaterial;
    // Selection is UI feedback, kept faint so it never reads as a light source.
    m.emissive.set(on ? "#ff9a3c" : "#000000");
    m.emissiveIntensity = on ? 0.12 : 0;
  }
}

export function disposeProp(view: PropView) {
  for (const mesh of view.meshes) {
    mesh.geometry.dispose();
    (mesh.material as MeshStandardMaterial).dispose(); // textures are shared and cached
  }
}
