import { describe, expect, test } from "bun:test";
import { CHAPTERS, hang, LIMITS } from "../src/game/chapters";
import { buildTarget, evaluate, type PlacedProp } from "../src/game/hints";
import { PROPS } from "../src/game/props";
import { LAMP, projectToWall, propShadow, unionMasks } from "../src/game/shadow";
import {
  chapterAt,
  evaluateState,
  type GameState,
  initialState,
  reduce,
  STEP,
} from "../src/game/state";
import type { Placement } from "../src/game/types";
import { adviceText, likenessWord, propNames } from "../src/game/words";

const radiusOf = (state: GameState) => (i: number) =>
  PROPS[chapterAt(state.chapter).props[i]?.kind ?? "thermos"].radius;

function act(state: GameState, ...actions: Parameters<typeof reduce>[1][]): GameState {
  return actions.reduce((s, a) => reduce(s, a, radiusOf(s)), state);
}

function solved(state: GameState): GameState {
  return { ...state, placements: chapterAt(state.chapter).props.map((p) => ({ ...p.solution })) };
}

/** Small deterministic generator so the fairness checks are repeatable. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function randomPlacement(r: () => number): Placement {
  return {
    x: LIMITS.minX + r() * (LIMITS.maxX - LIMITS.minX),
    y: 0.25 + r() * (LIMITS.maxY - 0.25),
    z: LIMITS.minZ + r() * (LIMITS.maxZ - LIMITS.minZ),
    turn: Math.floor(r() * 8),
    tilt: Math.floor(r() * 24),
  };
}

describe("chapters", () => {
  for (const ch of CHAPTERS) {
    const solution: PlacedProp[] = ch.props.map((p) => ({ kind: p.kind, at: p.solution }));
    const target = buildTarget(solution);

    test(`${ch.id}: uses two to four props, all reachable`, () => {
      expect(ch.props.length).toBeGreaterThanOrEqual(2);
      expect(ch.props.length).toBeLessThanOrEqual(4);
      for (const p of ch.props) {
        for (const at of [p.start, p.solution]) {
          expect(at.x).toBeGreaterThanOrEqual(LIMITS.minX);
          expect(at.x).toBeLessThanOrEqual(LIMITS.maxX);
          expect(at.y).toBeGreaterThanOrEqual(PROPS[p.kind].radius);
          expect(at.y).toBeLessThanOrEqual(LIMITS.maxY);
          expect(at.z).toBeGreaterThanOrEqual(LIMITS.minZ);
          expect(at.z).toBeLessThanOrEqual(LIMITS.maxZ);
        }
      }
    });

    test(`${ch.id}: the known answer passes and the starting clutter does not`, () => {
      expect(evaluate(solution, target).score).toBeGreaterThan(0.99);
      const start = ch.props.map((p) => ({ kind: p.kind, at: p.start }));
      expect(evaluate(start, target).score).toBeLessThan(ch.pass - 0.2);
    });

    test(`${ch.id}: small slips still pass (no pixel-perfect answer)`, () => {
      const r = rng(11);
      let passed = 0;
      for (let k = 0; k < 40; k++) {
        const nudged = solution.map((p) => ({
          kind: p.kind,
          at: { ...p.at, x: p.at.x + (r() - 0.5) * 0.04, y: p.at.y + (r() - 0.5) * 0.04 },
        }));
        if (evaluate(nudged, target).score >= ch.pass) passed++;
      }
      expect(passed).toBeGreaterThanOrEqual(32);
    });

    test(`${ch.id}: the whole figure may be made bigger, moved or mirrored`, () => {
      const moved = solution.map((p) => ({ kind: p.kind, at: { ...p.at, x: p.at.x + 0.08 } }));
      expect(evaluate(moved, target).score).toBeGreaterThan(ch.pass);
      for (const factor of [0.75, 1.2]) {
        const resized = solution.map((p) => {
          const centre = projectToWall([p.at.x, p.at.y, p.at.z]);
          const z = LAMP[2] - (LAMP[2] - p.at.z) / factor;
          const at = hang(
            target.figure.cx + (centre[0] - target.figure.cx) * factor,
            target.figure.cy + (centre[1] - target.figure.cy) * factor,
            z,
            p.at.turn,
            p.at.tilt,
          );
          return { kind: p.kind, at };
        });
        expect(evaluate(resized, target).score).toBeGreaterThan(ch.pass);
      }
      const mirrored = solution.map((p) => ({
        kind: p.kind,
        at: { ...p.at, x: -p.at.x, turn: (12 - p.at.turn) % 8, tilt: (24 - p.at.tilt) % 24 },
      }));
      expect(evaluate(mirrored, target).score).toBeGreaterThan(ch.pass);
    });

    test(`${ch.id}: random arrangements almost never pass`, () => {
      const r = rng(97);
      let lucky = 0;
      for (let k = 0; k < 200; k++) {
        const props = ch.props.map((p) => ({ kind: p.kind, at: randomPlacement(r) }));
        if (evaluate(props, target).score >= ch.pass) lucky++;
      }
      expect(lucky).toBeLessThanOrEqual(2);
    });
  }
});

describe("advice", () => {
  const ch = chapterAt(0);
  const target = buildTarget(ch.props.map((p) => ({ kind: p.kind, at: p.solution })));
  const solution = () => ch.props.map((p) => ({ kind: p.kind, at: { ...p.solution } }));

  test("says the figure is close when it is right", () => {
    expect(evaluate(solution(), target).advice.kind).toBe("close");
  });

  test("tells the stalk to meet a cap that hangs too low", () => {
    const props = solution();
    const cap = props[1];
    if (cap) cap.at.y -= 0.25;
    const advice = evaluate(props, target).advice;
    expect(advice).toMatchObject({ kind: "move", index: 0, dy: -1 });
  });

  test("asks for a bigger shadow when a prop has drifted to the wall", () => {
    const props = solution();
    const stalk = props[0];
    if (stalk) stalk.at.z = 1.2;
    expect(evaluate(props, target).advice).toMatchObject({ kind: "size", index: 0, grow: true });
  });

  test("notices a prop that has left the tent", () => {
    const props = solution();
    const stem = props[0];
    if (stem) stem.at = { x: 1.6, y: 1, z: 3.3, turn: 0, tilt: 0 };
    expect(evaluate(props, target).advice).toMatchObject({ kind: "offwall", index: 0 });
  });

  test("a fully hidden duplicate spoon cannot tell the rabbit story", () => {
    const rabbit = chapterAt(1);
    const solution = rabbit.props.map((prop) => ({ kind: prop.kind, at: prop.solution }));
    const target = buildTarget(solution);
    const spoon = hang(-0.1, 1.8, 3.2, 0, 3);
    const props = solution.map((prop, i) => ({
      kind: prop.kind,
      at: i === 0 ? prop.at : { ...spoon },
    }));
    const parts = props.map((prop) => propShadow(prop.kind, prop.at));
    expect(unionMasks(parts).data).toEqual(unionMasks(parts.slice(0, 2)).data);
    const evaluation = evaluate(props, target);
    expect(evaluation.score).toBeLessThan(rabbit.pass); // Previously 0.740, enough to pass.
    expect(evaluation.advice).toMatchObject({ kind: "overlap", index: 1 });
    expect(
      adviceText(evaluation.advice, propNames(rabbit.props.map((prop) => prop.kind))),
    ).toContain("wooden spoon 1's shadow is hidden");
    expect(evaluate(solution, target).score).toBeGreaterThan(0.99);
  });

  test("swapping visible twin spoons still counts as the same rabbit", () => {
    const rabbit = chapterAt(1);
    const solution = rabbit.props.map((prop) => ({ kind: prop.kind, at: prop.solution }));
    const target = buildTarget(solution);
    const swapped = solution.map((prop, i) => ({
      kind: prop.kind,
      at: solution[i === 1 ? 2 : i === 2 ? 1 : i]?.at ?? prop.at,
    }));
    const evaluation = evaluate(swapped, target);
    expect(evaluation.score).toBeGreaterThan(0.99);
    expect(evaluation.advice.kind).toBe("close");
  });
});

describe("game loop", () => {
  test("title → play → told → next chapter", () => {
    let s = act(initialState(), { type: "start" });
    expect(s.phase).toBe("play");
    s = act(s, { type: "settle" });
    expect(s.phase).toBe("play");
    s = act(solved(s), { type: "settle" });
    expect(s.phase).toBe("told");
    expect(s.told[0]?.some((v) => v === 1)).toBe(true);
    s = act(s, { type: "next" });
    expect(s).toMatchObject({ phase: "play", chapter: 1, hintLevel: 0 });
  });

  test("the last story leads to the tableau and replay starts over", () => {
    let s = act(initialState(), { type: "start" });
    for (let i = 0; i < CHAPTERS.length; i++)
      s = act(solved(s), { type: "settle" }, { type: "next" });
    expect(s.phase).toBe("tableau");
    expect(s.told).toHaveLength(CHAPTERS.length);
    s = act(s, { type: "replay" });
    expect(s).toMatchObject({ phase: "play", chapter: 0, told: [] });
  });

  test("nudges move the selected prop in steps and stay inside the campsite", () => {
    let s = act(initialState(), { type: "start" }, { type: "select", index: 1 });
    const before = s.placements[1];
    s = act(s, { type: "nudge", dx: 1, dy: -1, dz: 1, turn: 1, tilt: -1 });
    const after = s.placements[1];
    expect(after?.x).toBeCloseTo((before?.x ?? 0) + STEP.xy);
    expect(after?.z).toBeCloseTo((before?.z ?? 0) + STEP.z);
    expect(after?.turn).toBe(1);
    expect(after?.tilt).toBe(23);
    for (let i = 0; i < 80; i++) s = act(s, { type: "nudge", dx: 1, dz: 1, dy: -1 });
    expect(s.placements[1]).toMatchObject({ x: LIMITS.maxX, z: LIMITS.maxZ, y: PROPS.bowl.radius });
  });

  test("hints escalate to two levels, and reset restores the start", () => {
    let s = act(initialState(), { type: "start" }, { type: "place", index: 0, x: 1, y: 1 });
    s = act(s, { type: "hint" }, { type: "hint" }, { type: "hint" });
    expect(s.hintLevel).toBe(2);
    s = act(s, { type: "reset" });
    expect(s.placements).toEqual(chapterAt(0).props.map((p) => p.start));
    expect(s.hintLevel).toBe(2);
  });

  test("props cannot be moved outside of play", () => {
    const s = initialState();
    expect(act(s, { type: "nudge", dx: 1 })).toBe(s);
  });

  test("evaluation of the start state gives advice", () => {
    const s = act(initialState(), { type: "start" });
    expect(evaluateState(s).advice.kind).not.toBe("close");
  });
});

describe("words", () => {
  test("twins are numbered so advice can name them", () => {
    expect(propNames(["kettle", "spoon", "spoon"])).toEqual([
      "Kettle",
      "Wooden spoon 1",
      "Wooden spoon 2",
    ]);
  });

  test("advice reads as a plain instruction", () => {
    const names = ["Thermos", "Enamel bowl"];
    expect(adviceText({ kind: "move", index: 1, dx: -1, dy: 1 }, names)).toBe(
      "Move the enamel bowl's shadow up and to the left, next to the others.",
    );
    expect(adviceText({ kind: "size", index: 0, grow: true }, names)).toContain("toward the lamp");
    expect(adviceText({ kind: "offwall", index: 0 }, names)).toContain("off the tent");
  });

  test("the likeness word celebrates only a pass", () => {
    expect(likenessWord(0.81, 0.8)).toBe("That's it!");
    expect(likenessWord(0.79, 0.8)).toBe("So close");
    expect(likenessWord(0.1, 0.8)).toBe("Just shadows");
  });
});
