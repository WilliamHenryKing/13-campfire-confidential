import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";
import { PROPS } from "../game/props";
import { TILT_STEP, TURN_STEP } from "../game/shadow";
import type { Material, Placement, Primitive, PropKind } from "../game/types";

// Meshes built from exactly the primitives the rules project, in a soft clay palette.

const PALETTE: Record<Material, { color: string; roughness: number; metalness: number }> = {
  enamel: { color: "#4f86a8", roughness: 0.45, metalness: 0 },
  cream: { color: "#efe3c8", roughness: 0.5, metalness: 0 },
  steel: { color: "#a4abae", roughness: 0.35, metalness: 0.6 },
  wood: { color: "#c38c56", roughness: 0.7, metalness: 0 },
  leather: { color: "#8a5434", roughness: 0.75, metalness: 0 },
  rubber: { color: "#2e2824", roughness: 0.85, metalness: 0 },
  cone: { color: "#6e4a2b", roughness: 0.9, metalness: 0 },
  red: { color: "#c4553b", roughness: 0.5, metalness: 0.05 },
};

const materials = new Map<Material, MeshStandardMaterial>();

function material(key: Material): MeshStandardMaterial {
  let m = materials.get(key);
  if (!m) {
    const p = PALETTE[key];
    m = new MeshStandardMaterial({
      color: p.color,
      roughness: p.roughness,
      metalness: p.metalness,
      flatShading: key === "cone",
    });
    materials.set(key, m);
  }
  return m;
}

function geometry(p: Primitive): BufferGeometry {
  switch (p.kind) {
    case "box":
      return new BoxGeometry(...p.size);
    case "cyl":
      return new CylinderGeometry(p.rTop, p.rBottom, p.height, p.mat === "cone" ? 9 : 28);
    case "ellipsoid":
      return new SphereGeometry(p.radius, p.mat === "cone" ? 9 : 28, p.mat === "cone" ? 7 : 18);
    case "dome":
      return new SphereGeometry(p.radius, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
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
    const mesh = new Mesh(geometry(prim), material(prim.mat).clone());
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
    m.emissive.set(on ? "#ff9a3c" : "#000000");
    m.emissiveIntensity = on ? 0.28 : 0;
  }
}

export function disposeProp(view: PropView) {
  for (const mesh of view.meshes) {
    mesh.geometry.dispose();
    (mesh.material as MeshStandardMaterial).dispose();
  }
}
