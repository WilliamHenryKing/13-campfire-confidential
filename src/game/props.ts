import type { PropDef, PropKind } from "./types";

// Every prop is authored as a few convex solids. The same list drives the meshes in
// src/scene and the shadow the rules measure, so what you see is what is judged.

const HALF_PI = Math.PI / 2;

const thermos: PropDef = {
  kind: "thermos",
  name: "Thermos",
  radius: 0.24,
  primitives: [
    { kind: "cyl", rTop: 0.07, rBottom: 0.07, height: 0.32, pos: [0, -0.06, 0], mat: "red" },
    { kind: "cyl", rTop: 0.078, rBottom: 0.078, height: 0.1, pos: [0, 0.15, 0], mat: "steel" },
    { kind: "box", size: [0.03, 0.2, 0.03], pos: [0.085, -0.05, 0], mat: "rubber" },
  ],
};

const bowl: PropDef = {
  kind: "bowl",
  name: "Enamel bowl",
  radius: 0.19,
  primitives: [
    { kind: "dome", radius: 0.18, scaleY: 0.72, pos: [0, -0.05, 0], mat: "enamel" },
    { kind: "cyl", rTop: 0.19, rBottom: 0.19, height: 0.018, pos: [0, -0.05, 0], mat: "cream" },
    { kind: "cyl", rTop: 0.05, rBottom: 0.06, height: 0.03, pos: [0, 0.09, 0], mat: "enamel" },
  ],
};

const kettle: PropDef = {
  kind: "kettle",
  name: "Kettle",
  radius: 0.22,
  primitives: [
    { kind: "ellipsoid", radius: 0.13, scale: [1, 0.8, 1], pos: [0, -0.03, 0], mat: "enamel" },
    {
      kind: "cyl",
      rTop: 0.012,
      rBottom: 0.032,
      height: 0.16,
      pos: [0.15, 0.0, 0],
      rot: [0, 0, -0.85],
      mat: "enamel",
    },
    { kind: "cyl", rTop: 0.05, rBottom: 0.07, height: 0.03, pos: [0, 0.085, 0], mat: "cream" },
    { kind: "ellipsoid", radius: 0.022, scale: [1, 1, 1], pos: [0, 0.11, 0], mat: "rubber" },
    {
      kind: "box",
      size: [0.1, 0.018, 0.018],
      pos: [-0.12, 0.05, 0],
      rot: [0, 0, 0.9],
      mat: "steel",
    },
  ],
};

const spoon: PropDef = {
  kind: "spoon",
  name: "Wooden spoon",
  radius: 0.2,
  primitives: [
    { kind: "ellipsoid", radius: 0.065, scale: [1, 1.6, 0.35], pos: [0, 0.1, 0], mat: "wood" },
    { kind: "box", size: [0.026, 0.26, 0.016], pos: [0, -0.1, 0], mat: "wood" },
  ],
};

const boot: PropDef = {
  kind: "boot",
  name: "Hiking boot",
  radius: 0.22,
  primitives: [
    { kind: "box", size: [0.36, 0.035, 0.11], pos: [0.02, -0.145, 0], mat: "rubber" },
    { kind: "box", size: [0.26, 0.09, 0.1], pos: [0, -0.085, 0], mat: "leather" },
    {
      kind: "ellipsoid",
      radius: 0.06,
      scale: [1.3, 0.8, 0.8],
      pos: [0.14, -0.09, 0],
      mat: "leather",
    },
    { kind: "box", size: [0.11, 0.24, 0.1], pos: [-0.1, 0.03, 0], mat: "leather" },
    { kind: "box", size: [0.12, 0.03, 0.105], pos: [-0.1, 0.155, 0], mat: "cream" },
  ],
};

const pan: PropDef = {
  kind: "pan",
  name: "Frying pan",
  radius: 0.36,
  primitives: [
    {
      kind: "cyl",
      rTop: 0.15,
      rBottom: 0.13,
      height: 0.035,
      pos: [-0.08, 0, 0],
      rot: [HALF_PI, 0, 0],
      mat: "steel",
    },
    { kind: "box", size: [0.2, 0.028, 0.02], pos: [0.16, 0, 0], mat: "wood" },
  ],
};

const pinecone: PropDef = {
  kind: "pinecone",
  name: "Pine cone",
  radius: 0.2,
  primitives: [
    { kind: "cyl", rTop: 0, rBottom: 0.1, height: 0.22, pos: [0, 0.06, 0], mat: "cone" },
    { kind: "ellipsoid", radius: 0.1, scale: [1, 0.7, 1], pos: [0, -0.06, 0], mat: "cone" },
    { kind: "cyl", rTop: 0.015, rBottom: 0.012, height: 0.05, pos: [0, -0.14, 0], mat: "wood" },
  ],
};

export const PROPS: Record<PropKind, PropDef> = {
  thermos,
  bowl,
  kettle,
  spoon,
  boot,
  pan,
  pinecone,
};
