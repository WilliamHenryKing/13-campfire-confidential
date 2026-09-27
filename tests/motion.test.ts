import { describe, expect, test } from "bun:test";
import { ALIVE_SECONDS, alive, kick, stepSwing } from "../src/scene/motion";

describe("prop motion", () => {
  test("a nudged prop swings and then comes to rest", () => {
    const s = { angle: 0, vel: 0 };
    kick(s, 0.1);
    expect(stepSwing(s, 1 / 60)).toBe(true);
    expect(Math.abs(s.angle)).toBeGreaterThan(0);
    let frames = 0;
    while (stepSwing(s, 1 / 60) && frames < 600) frames++;
    expect(frames).toBeLessThan(600);
    expect(s.angle).toBe(0);
  });

  test("swing stays small whatever the push", () => {
    const s = { angle: 0, vel: 0 };
    for (let i = 0; i < 20; i++) kick(s, 0.5);
    for (let i = 0; i < 30; i++) stepSwing(s, 1 / 60);
    expect(Math.abs(s.angle)).toBeLessThanOrEqual(0.12);
  });

  test("the mushroom sways and settles; the rocket lifts off", () => {
    expect(alive("mushroom", 0).dx).toBeCloseTo(0);
    expect(Math.abs(alive("mushroom", 1).roll)).toBeGreaterThan(0);
    expect(alive("mushroom", ALIVE_SECONDS).roll).toBeCloseTo(0);
    expect(alive("rocket", ALIVE_SECONDS).dy).toBeGreaterThan(0.5);
    expect(alive("snail", ALIVE_SECONDS).dx).toBeGreaterThan(0);
  });
});
