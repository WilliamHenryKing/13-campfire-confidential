import { GRID_H, GRID_W, type Mask, WALL } from "./shadow";

// Fair matching: shadows are compared after centring each figure on its own centroid and
// scaling by sqrt(area). So a figure counts anywhere on the wall, at any size, and mirrored.

export const NORM = 48;
/** Half-extent of the normalised frame in units of sqrt(area). */
export const NORM_EXTENT = 2.1;
/** How far below a chapter's pass mark the figure starts to read as the story. */
export const CLOSE_MARGIN = 0.15;

export interface Frame {
  cx: number;
  cy: number;
  scale: number;
  mirror: boolean;
}

export function frameOf(mask: Mask, mirror = false): Frame {
  return { cx: mask.cx, cy: mask.cy, scale: mask.scale, mirror };
}

/** Sample a wall mask into the normalised grid of a given frame. Row 0 is the bottom. */
export function normalise(mask: Mask, frame: Frame = frameOf(mask)): Uint8Array {
  const out = new Uint8Array(NORM * NORM);
  if (frame.scale <= 0) return out;
  const step = (2 * NORM_EXTENT) / NORM;
  for (let j = 0; j < NORM; j++) {
    const v = -NORM_EXTENT + (j + 0.5) * step;
    const wy = frame.cy + v * frame.scale;
    const gj = Math.floor((wy - WALL.minY) / WALL.cell);
    if (gj < 0 || gj >= GRID_H) continue;
    for (let i = 0; i < NORM; i++) {
      const u = -NORM_EXTENT + (i + 0.5) * step;
      const wx = frame.cx + (frame.mirror ? -u : u) * frame.scale;
      const gi = Math.floor((wx - WALL.minX) / WALL.cell);
      if (gi < 0 || gi >= GRID_W) continue;
      if (mask.data[gj * GRID_W + gi]) out[j * NORM + i] = 1;
    }
  }
  return out;
}

/**
 * Overlap (Dice) of two normalised grids. Normalising already forgives position and size; a
 * slack band on top made plain blobs pass for mushrooms, so the comparison itself is strict
 * and the pass mark carries the tolerance.
 */
export function likeness(a: Uint8Array, b: Uint8Array): number {
  let na = 0;
  let nb = 0;
  let both = 0;
  for (let k = 0; k < a.length; k++) {
    if (a[k]) na++;
    if (b[k]) nb++;
    if (a[k] && b[k]) both++;
  }
  if (na === 0 || nb === 0) return 0;
  return (2 * both) / (na + nb);
}

export interface Match {
  score: number;
  mirror: boolean;
}

/** Best likeness of a current shadow against a target shadow, allowing a mirror image. */
export function matchShadow(current: Mask, target: Mask): Match {
  if (current.count === 0 || target.count === 0) return { score: 0, mirror: false };
  const t = normalise(target);
  const straight = likeness(normalise(current), t);
  const mirrored = likeness(normalise(current, frameOf(current, true)), t);
  return mirrored > straight
    ? { score: mirrored, mirror: true }
    : { score: straight, mirror: false };
}
