import { describe, expect, test } from "bun:test";
import { likeness, matchShadow, NORM, normalise } from "../src/game/compare";
import { PROPS } from "../src/game/props";
import {
  convexHull,
  LAMP,
  magnification,
  primitiveWorldPoints,
  projectToWall,
  propShadow,
  unionMasks,
  WALL,
} from "../src/game/shadow";
import { clampPlacement } from "../src/game/state";

const still = { x: 0, y: 1.2, z: 2, turn: 0, tilt: 0 };

test("every floor-clamped prop stays above ground through all turn and tilt steps", () => {
  for (const prop of Object.values(PROPS)) {
    for (let turn = 0; turn < 8; turn++) {
      for (let tilt = 0; tilt < 24; tilt++) {
        const at = clampPlacement({ ...still, y: -1, turn, tilt }, prop.radius);
        const points = prop.primitives.flatMap((primitive) => primitiveWorldPoints(primitive, at));
        const lowest = Math.min(...points.map((point) => point[1]));
        expect(lowest).toBeGreaterThanOrEqual(0);
      }
    }
  }
});

describe("projection", () => {
  test("a point on the wall casts its shadow on itself", () => {
    expect(projectToWall([1.2, 0.8, 0])).toEqual([1.2, 0.8]);
  });

  test("shadows grow toward the lamp", () => {
    expect(magnification(0)).toBe(1);
    expect(magnification(LAMP[2] / 2)).toBeCloseTo(2);
    const near = propShadow("thermos", { ...still, z: 3 });
    const far = propShadow("thermos", { ...still, z: 1 });
    expect(near.scale).toBeGreaterThan(far.scale * 1.8);
  });

  test("moving a prop sideways moves its shadow the same way", () => {
    const left = propShadow("kettle", { ...still, x: -0.5 });
    const right = propShadow("kettle", { ...still, x: 0.5 });
    expect(right.cx - left.cx).toBeGreaterThan(1);
  });

  test("convex hull drops interior points", () => {
    const hull = convexHull([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0.5, 0.5],
    ]);
    expect(hull).toHaveLength(4);
    expect(hull).toContainEqual([1, 1]);
    expect(hull).not.toContainEqual([0.5, 0.5]);
  });
});

describe("shadow masks", () => {
  test("a shadow thrown off the wall is lost", () => {
    const high = propShadow("bowl", { x: 1.6, y: 2.1, z: 3.3, turn: 0, tilt: 0 });
    expect(high.count).toBeLessThan(propShadow("bowl", still).count);
    const aside = propShadow("spoon", { x: 1.6, y: 1, z: 3.3, turn: 0, tilt: 0 });
    expect(aside.count).toBe(0);
  });

  test("area matches the projected size of a simple shape", () => {
    const m = magnification(still.z);
    const mask = propShadow("thermos", { ...still, turn: 2 });
    const area = mask.count * WALL.cell * WALL.cell;
    expect(area).toBeGreaterThan(0.14 * 0.4 * m * m * 0.8);
    expect(area).toBeLessThan(0.17 * 0.44 * m * m * 1.3);
  });

  test("turning a pan edge-on shrinks its shadow to a sliver", () => {
    const face = propShadow("pan", still);
    const edge = propShadow("pan", { ...still, turn: 2 });
    expect(edge.count).toBeLessThan(face.count * 0.35);
  });

  test("the union covers each separate part", () => {
    const a = propShadow("thermos", { ...still, x: -0.6 });
    const b = propShadow("bowl", { ...still, x: 0.6 });
    expect(unionMasks([a, b]).count).toBe(a.count + b.count);
  });
});

describe("matching", () => {
  test("likeness is 1 for identical figures and 0 for disjoint ones", () => {
    const a = new Uint8Array(NORM * NORM);
    const b = new Uint8Array(NORM * NORM);
    a[10] = 1;
    b[20] = 1;
    expect(likeness(a, a)).toBe(1);
    expect(likeness(a, b)).toBe(0);
  });

  test("a figure matches itself anywhere on the wall and at any size", () => {
    const target = propShadow("boot", still);
    const moved = propShadow("boot", { ...still, x: 0.7, y: 0.9, z: 2.6 });
    expect(matchShadow(moved, target).score).toBeGreaterThan(0.8);
  });

  test("a mirrored figure still counts", () => {
    const target = propShadow("boot", still);
    const flipped = propShadow("boot", { ...still, turn: 4 });
    const m = matchShadow(flipped, target);
    expect(m.mirror).toBe(true);
    expect(m.score).toBeGreaterThan(0.8);
  });

  test("different props do not pass for each other", () => {
    const boot = propShadow("boot", still);
    const spoon = propShadow("spoon", still);
    expect(matchShadow(spoon, boot).score).toBeLessThan(0.6);
  });

  test("normalising an empty mask yields an empty grid", () => {
    const empty = propShadow("spoon", { x: 1.6, y: 1, z: 3.3, turn: 0, tilt: 0 });
    expect(normalise(empty).some((v) => v === 1)).toBe(false);
  });
});
