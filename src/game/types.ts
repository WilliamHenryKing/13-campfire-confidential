// Shared shapes for the pure game rules. Units are metres; the tent wall is the plane z = 0.

export type Vec3 = readonly [number, number, number];

export type Material =
  | "enamel"
  | "cream"
  | "steel"
  | "wood"
  | "leather"
  | "rubber"
  | "cone"
  | "red";

/** A convex solid in a prop's local space. Every prop is a union of these. */
export type Primitive =
  | { kind: "box"; size: Vec3; pos: Vec3; rot?: Vec3; mat: Material }
  | {
      kind: "cyl";
      rTop: number;
      rBottom: number;
      height: number;
      pos: Vec3;
      rot?: Vec3;
      mat: Material;
    }
  | { kind: "ellipsoid"; radius: number; scale: Vec3; pos: Vec3; rot?: Vec3; mat: Material }
  | { kind: "dome"; radius: number; scaleY: number; pos: Vec3; mat: Material };

export type PropKind = "thermos" | "bowl" | "kettle" | "spoon" | "boot" | "pan" | "pinecone";

export interface PropDef {
  kind: PropKind;
  name: string;
  /** Bounding radius; the lowest a prop can hang is this far above the ground. */
  radius: number;
  primitives: readonly Primitive[];
}

/** Where a prop hangs: centre position plus turn (yaw about Y) and tilt (roll about Z). */
export interface Placement {
  x: number;
  y: number;
  z: number;
  /** Yaw in 45° steps. */
  turn: number;
  /** Roll in 15° steps. */
  tilt: number;
}

export interface PropInstance {
  id: string;
  kind: PropKind;
}
