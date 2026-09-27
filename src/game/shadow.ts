import { PROPS } from "./props";
import type { Placement, Primitive, PropKind, Vec3 } from "./types";

// Point-light shadow projection onto the tent wall (z = 0), rasterised to a coarse mask.
// Rotations follow three.js: primitive rot is Euler XYZ, placement is Euler(0, turn, tilt, "ZYX").

export const LAMP: Vec3 = [0, 0.35, 4.4];

export const WALL = {
  minX: -3.4,
  maxX: 3.4,
  minY: 0,
  maxY: 3.4,
  cell: 0.05,
} as const;

export const GRID_W = Math.round((WALL.maxX - WALL.minX) / WALL.cell);
export const GRID_H = Math.round((WALL.maxY - WALL.minY) / WALL.cell);

export const TURN_STEP = Math.PI / 4;
export const TILT_STEP = Math.PI / 12;

export interface Mask {
  data: Uint8Array;
  count: number;
  /** Centroid and sqrt(area) in wall metres; zero when the mask is empty. */
  cx: number;
  cy: number;
  scale: number;
}

type Mut3 = [number, number, number];

function rotX(p: Mut3, a: number) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const y = p[1] * c - p[2] * s;
  p[2] = p[1] * s + p[2] * c;
  p[1] = y;
}

function rotY(p: Mut3, a: number) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const x = p[0] * c + p[2] * s;
  p[2] = -p[0] * s + p[2] * c;
  p[0] = x;
}

function rotZ(p: Mut3, a: number) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const x = p[0] * c - p[1] * s;
  p[1] = p[0] * s + p[1] * c;
  p[0] = x;
}

function ring(out: Mut3[], r: number, y: number, n: number, sx = 1, sz = 1) {
  if (r === 0) {
    out.push([0, y, 0]);
    return;
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([Math.cos(a) * r * sx, y, Math.sin(a) * r * sz]);
  }
}

/** Hull sample points of a primitive in its own frame (before pos/rot). */
function localPoints(p: Primitive): Mut3[] {
  const out: Mut3[] = [];
  switch (p.kind) {
    case "box": {
      const [w, h, d] = p.size;
      for (const sx of [-0.5, 0.5])
        for (const sy of [-0.5, 0.5])
          for (const sz of [-0.5, 0.5]) out.push([sx * w, sy * h, sz * d]);
      break;
    }
    case "cyl":
      ring(out, p.rTop, p.height / 2, 20);
      ring(out, p.rBottom, -p.height / 2, 20);
      break;
    case "ellipsoid": {
      const [sx, sy, sz] = p.scale;
      for (let i = 0; i <= 8; i++) {
        const t = (i / 8) * Math.PI;
        ring(out, Math.sin(t) * p.radius, Math.cos(t) * p.radius * sy, 16, sx, sz);
      }
      break;
    }
    case "dome":
      for (let i = 0; i <= 5; i++) {
        const t = (i / 5) * (Math.PI / 2);
        ring(out, Math.sin(t) * p.radius, Math.cos(t) * p.radius * p.scaleY, 16);
      }
      break;
  }
  return out;
}

/** World-space hull points of one primitive of a placed prop. */
export function primitiveWorldPoints(prim: Primitive, at: Placement): Mut3[] {
  const pts = localPoints(prim);
  const rot = "rot" in prim ? prim.rot : undefined;
  const turn = at.turn * TURN_STEP;
  const tilt = at.tilt * TILT_STEP;
  for (const p of pts) {
    if (rot) {
      rotZ(p, rot[2]);
      rotY(p, rot[1]);
      rotX(p, rot[0]);
    }
    p[0] += prim.pos[0];
    p[1] += prim.pos[1];
    p[2] += prim.pos[2];
    rotY(p, turn);
    rotZ(p, tilt);
    p[0] += at.x;
    p[1] += at.y;
    p[2] += at.z;
  }
  return pts;
}

/** Where a world point's shadow lands on the wall. Points must sit between lamp and wall. */
export function projectToWall(p: readonly number[], lamp: Vec3 = LAMP): [number, number] {
  const m = lamp[2] / (lamp[2] - (p[2] ?? 0));
  return [lamp[0] + ((p[0] ?? 0) - lamp[0]) * m, lamp[1] + ((p[1] ?? 0) - lamp[1]) * m];
}

/** Shadow magnification at depth z (1 at the wall, growing toward the lamp). */
export function magnification(z: number, lamp: Vec3 = LAMP): number {
  return lamp[2] / (lamp[2] - z);
}

function cross(o: number[], a: number[], b: number[]) {
  return (
    ((a[0] ?? 0) - (o[0] ?? 0)) * ((b[1] ?? 0) - (o[1] ?? 0)) -
    ((a[1] ?? 0) - (o[1] ?? 0)) * ((b[0] ?? 0) - (o[0] ?? 0))
  );
}

/** Counter-clockwise convex hull (Andrew's monotone chain). */
export function convexHull(points: number[][]): number[][] {
  const pts = [...points].sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0) || (a[1] ?? 0) - (b[1] ?? 0));
  if (pts.length < 3) return pts;
  const lower: number[][] = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2] ?? p, lower[lower.length - 1] ?? p, p) <= 0
    )
      lower.pop();
    lower.push(p);
  }
  const upper: number[][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i] ?? [0, 0];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2] ?? p, upper[upper.length - 1] ?? p, p) <= 0
    )
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function fillHull(data: Uint8Array, hull: number[][]) {
  if (hull.length < 3) return;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x = 0, y = 0] of hull) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const i0 = Math.max(0, Math.floor((minX - WALL.minX) / WALL.cell));
  const i1 = Math.min(GRID_W - 1, Math.ceil((maxX - WALL.minX) / WALL.cell));
  const j0 = Math.max(0, Math.floor((minY - WALL.minY) / WALL.cell));
  const j1 = Math.min(GRID_H - 1, Math.ceil((maxY - WALL.minY) / WALL.cell));
  const n = hull.length;
  for (let j = j0; j <= j1; j++) {
    const py = WALL.minY + (j + 0.5) * WALL.cell;
    for (let i = i0; i <= i1; i++) {
      const px = WALL.minX + (i + 0.5) * WALL.cell;
      let inside = true;
      for (let k = 0; k < n && inside; k++) {
        const a = hull[k] ?? [0, 0];
        const b = hull[(k + 1) % n] ?? [0, 0];
        if (cross(a, b, [px, py]) < 0) inside = false;
      }
      if (inside) data[j * GRID_W + i] = 1;
    }
  }
}

export function emptyMask(): Mask {
  return { data: new Uint8Array(GRID_W * GRID_H), count: 0, cx: 0, cy: 0, scale: 0 };
}

/** Recompute count, centroid and scale from the raw data. */
export function finishMask(mask: Mask): Mask {
  let count = 0;
  let sx = 0;
  let sy = 0;
  for (let j = 0; j < GRID_H; j++)
    for (let i = 0; i < GRID_W; i++)
      if (mask.data[j * GRID_W + i]) {
        count++;
        sx += i;
        sy += j;
      }
  mask.count = count;
  if (count === 0) {
    mask.cx = 0;
    mask.cy = 0;
    mask.scale = 0;
    return mask;
  }
  mask.cx = WALL.minX + (sx / count + 0.5) * WALL.cell;
  mask.cy = WALL.minY + (sy / count + 0.5) * WALL.cell;
  mask.scale = Math.sqrt(count) * WALL.cell;
  return mask;
}

/** The shadow one placed prop casts on the wall. */
export function propShadow(kind: PropKind, at: Placement): Mask {
  const mask = emptyMask();
  for (const prim of PROPS[kind].primitives) {
    const pts = primitiveWorldPoints(prim, at).map((p) => projectToWall(p));
    fillHull(mask.data, convexHull(pts));
  }
  return finishMask(mask);
}

export function unionMasks(masks: readonly Mask[]): Mask {
  const out = emptyMask();
  for (const m of masks) for (let k = 0; k < out.data.length; k++) if (m.data[k]) out.data[k] = 1;
  return finishMask(out);
}
