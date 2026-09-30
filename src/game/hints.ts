import { frameOf, likeness, type Match, matchShadow, normalise } from "./compare";
import { type Mask, propShadow, unionMasks } from "./shadow";
import type { Placement, PropKind } from "./types";

// Readable feedback: compare each prop's shadow, relative to the whole figure, with the
// same prop in a known good figure, and describe the single most useful change.

export interface PlacedProp {
  kind: PropKind;
  at: Placement;
}

export type Advice =
  | { kind: "offwall"; index: number }
  | { kind: "overlap"; index: number }
  | { kind: "move"; index: number; dx: -1 | 0 | 1; dy: -1 | 0 | 1 }
  | { kind: "size"; index: number; grow: boolean }
  | { kind: "turn"; index: number }
  | { kind: "close" };

export interface Evaluation {
  score: number;
  mirror: boolean;
  figure: Mask;
  advice: Advice;
}

interface Rel {
  u: number;
  v: number;
  size: number;
}

function relative(prop: Mask, figure: Mask, mirror: boolean): Rel {
  const s = figure.scale || 1;
  const u = (prop.cx - figure.cx) / s;
  return { u: mirror ? -u : u, v: (prop.cy - figure.cy) / s, size: prop.scale / s };
}

/** Pair each placed prop with a solution prop of the same kind, trying swaps of twins. */
function pairings(kinds: readonly PropKind[]): number[][] {
  const out: number[][] = [kinds.map((_, i) => i)];
  for (let a = 0; a < kinds.length; a++)
    for (let b = a + 1; b < kinds.length; b++)
      if (kinds[a] === kinds[b]) {
        const p = kinds.map((_, i) => i);
        p[a] = b;
        p[b] = a;
        out.push(p);
      }
  return out;
}

export interface Target {
  figure: Mask;
  parts: Mask[];
  kinds: PropKind[];
}

export function buildTarget(solution: readonly PlacedProp[]): Target {
  const parts = solution.map((p) => propShadow(p.kind, p.at));
  return { figure: unionMasks(parts), parts, kinds: solution.map((p) => p.kind) };
}

/**
 * Every prop has to play its part: a prop whose shadow is much smaller a share of the figure
 * than in a known answer (off the wall, or shrunk to a dot) scales the likeness down.
 */
function participation(parts: readonly Mask[], figure: Mask, target: Target): number {
  if (figure.count === 0) return 0;
  const mine = parts.map((m) => m.count / figure.count).sort((a, b) => a - b);
  const ref = target.parts.map((m) => m.count / target.figure.count).sort((a, b) => a - b);
  let factor = 1;
  mine.forEach((share, i) => {
    const want = ref[i] ?? 0;
    if (want > 0) factor = Math.min(factor, Math.min(1, share / (0.5 * want)));
  });
  return factor;
}

export function evaluate(props: readonly PlacedProp[], target: Target): Evaluation {
  const parts = props.map((p) => propShadow(p.kind, p.at));
  const figure = unionMasks(parts);
  const match: Match = matchShadow(figure, target.figure);
  // An isolated silhouette has area even when another prop hides all of it on the tent.
  // Such a prop contributes nothing to the visible figure and must not count twice.
  const hidden = parts.findIndex(
    (part, index) =>
      part.count > 0 &&
      !part.data.some(
        (pixel, cell) => pixel && parts.every((other, j) => j === index || !other.data[cell]),
      ),
  );
  const base = {
    score: hidden >= 0 ? 0 : match.score * participation(parts, figure, target),
    mirror: match.mirror,
    figure,
  };

  const off = parts.findIndex((m) => m.count < 4);
  if (off >= 0) return { ...base, advice: { kind: "offwall", index: off } };
  if (hidden >= 0) return { ...base, advice: { kind: "overlap", index: hidden } };

  const mine = parts.map((m) => relative(m, figure, match.mirror));
  const ref = target.parts.map((m) => relative(m, target.figure, false));

  let best: { perm: number[]; cost: number } | null = null;
  for (const perm of pairings(target.kinds)) {
    let cost = 0;
    perm.forEach((j, i) => {
      const a = mine[i];
      const b = ref[j];
      if (a && b) cost += Math.hypot(a.u - b.u, a.v - b.v);
    });
    if (!best || cost < best.cost) best = { perm, cost };
  }
  const perm = best?.perm ?? [];

  // Positions are judged against the prop that makes the biggest part of the figure, so the
  // advice keeps naming the same props instead of flip-flopping around a moving centroid.
  const anchorRef = target.parts.reduce(
    (best, m, j) => (m.count > (target.parts[best]?.count ?? 0) ? j : best),
    0,
  );
  const anchor = Math.max(0, perm.indexOf(anchorRef));
  const mineA = mine[anchor] ?? { u: 0, v: 0, size: 1 };
  const refA = ref[anchorRef] ?? { u: 0, v: 0, size: 1 };

  // Teach in a sensible order: size first (it also shifts a shadow), then shape, then place.
  const found: Record<"size" | "turn" | "move", { score: number; advice: Advice } | null> = {
    size: null,
    turn: null,
    move: null,
  };
  const consider = (key: "size" | "turn" | "move", score: number, advice: Advice) => {
    const cur = found[key];
    if (!cur || score > cur.score) found[key] = { score, advice };
  };
  parts.forEach((part, i) => {
    const j = perm[i] ?? i;
    const a = mine[i];
    const b = ref[j];
    const refPart = target.parts[j];
    if (!a || !b || !refPart) return;
    const ratio =
      i === anchor ? 0 : Math.log((b.size / refA.size) * (mineA.size / Math.max(a.size, 1e-6)));
    if (Math.abs(ratio) > 0.22)
      consider("size", Math.abs(ratio), { kind: "size", index: i, grow: ratio > 0 });
    const shape = likeness(
      normalise(part, frameOf(part, match.mirror)),
      normalise(refPart, frameOf(refPart, false)),
    );
    if (shape < 0.6) consider("turn", 1 - shape, { kind: "turn", index: i });
    if (i === anchor) return;
    const du = b.u - refA.u - (a.u - mineA.u);
    const dv = b.v - refA.v - (a.v - mineA.v);
    const dist = Math.hypot(du, dv);
    if (dist > 0.15) {
      const dx = Math.abs(du) > 0.1 ? (Math.sign(du) as -1 | 1) : 0;
      const dy = Math.abs(dv) > 0.1 ? (Math.sign(dv) as -1 | 1) : 0;
      const screenDx = (match.mirror ? -dx : dx) as -1 | 0 | 1;
      consider("move", dist, { kind: "move", index: i, dx: screenDx, dy });
    }
  });
  const worst = found.size ?? found.turn ?? found.move ?? { advice: { kind: "close" } as Advice };
  return { ...base, advice: worst.advice };
}
