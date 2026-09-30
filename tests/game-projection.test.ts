import { expect, test } from "bun:test";
import { Euler, Vector3 } from "three";
import { PROPS } from "../src/game/props";
import {
  LAMP,
  primitiveWorldPoints,
  projectToWall,
  TILT_STEP,
  TURN_STEP,
} from "../src/game/shadow";
import type { Primitive } from "../src/game/types";

test("judged vertices agree with the mesh Euler transforms and a ray hitting the tent", () => {
  const origin = { x: 0, y: 0, z: 0, turn: 0, tilt: 0 };
  let worldError = 0;
  let shadowError = 0;
  for (const prop of Object.values(PROPS)) {
    for (const primitive of prop.primitives) {
      const bare: Primitive = {
        ...primitive,
        pos: [0, 0, 0],
        ...("rot" in primitive ? { rot: [0, 0, 0] as const } : {}),
      };
      const local = primitiveWorldPoints(bare, origin);
      const angles = "rot" in primitive ? primitive.rot : undefined;
      const inner = new Euler(angles?.[0] ?? 0, angles?.[1] ?? 0, angles?.[2] ?? 0, "XYZ");
      for (const [turn, tilt] of [
        [3, 5],
        [7, -9],
      ] as const) {
        const at = { x: 0.47, y: 1.12, z: 2.35, turn, tilt };
        const outer = new Euler(0, turn * TURN_STEP, tilt * TILT_STEP, "ZYX");
        const actual = primitiveWorldPoints(primitive, at);
        for (const [index, point] of local.entries()) {
          const transformed = new Vector3(...point)
            .applyEuler(inner)
            .add(new Vector3(...primitive.pos))
            .applyEuler(outer)
            .add(new Vector3(at.x, at.y, at.z));
          const judged = actual[index];
          if (!judged) throw new Error("Missing judged vertex");
          worldError = Math.max(worldError, transformed.distanceTo(new Vector3(...judged)));
          const lamp = new Vector3(...LAMP);
          const ray = transformed.clone().sub(lamp);
          const hit = lamp.add(ray.multiplyScalar(-lamp.z / ray.z));
          const projected = projectToWall(judged);
          shadowError = Math.max(
            shadowError,
            Math.hypot(projected[0] - hit.x, projected[1] - hit.y),
          );
        }
      }
    }
  }
  expect(worldError).toBeLessThan(1e-10);
  expect(shadowError).toBeLessThan(1e-10);
});
