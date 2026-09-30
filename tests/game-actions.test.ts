import { describe, expect, test } from "bun:test";
import { CHAPTERS, type Chapter, LIMITS } from "../src/game/chapters";
import { normalise } from "../src/game/compare";
import { PROPS } from "../src/game/props";
import {
  type Action,
  chapterAt,
  evaluateState,
  type GameState,
  initialState,
  reduce,
  STEP,
} from "../src/game/state";

function act(state: GameState, action: Action): GameState {
  return reduce(state, action, (index) => {
    const kind = chapterAt(state.chapter).props[index]?.kind;
    if (!kind) throw new Error("No selected prop");
    return PROPS[kind].radius;
  });
}

/** The same finite steps exposed by the keyboard and control pad; no posed solution state. */
function controlRoute(chapter: Chapter): Action[] {
  const route: Action[] = [];
  const add = (field: "dx" | "dy" | "dz" | "turn" | "tilt", steps: number) => {
    for (let i = 0; i < Math.abs(steps); i++)
      route.push({ type: "nudge", [field]: Math.sign(steps) });
  };
  for (const [index, prop] of chapter.props.entries()) {
    route.push({ type: "select", index });
    add("dz", Math.round((prop.solution.z - prop.start.z) / STEP.z));
    add("dx", Math.round((prop.solution.x - prop.start.x) / STEP.xy));
    add("dy", Math.round((prop.solution.y - prop.start.y) / STEP.xy));
    add("turn", (((prop.solution.turn - prop.start.turn) % 8) + 8) % 8);
    let tilt = (((prop.solution.tilt - prop.start.tilt) % 24) + 24) % 24;
    if (tilt > 12) tilt -= 24;
    add("tilt", tilt);
  }
  return route;
}

describe("effective prop edits", () => {
  test("a drag to the same spot preserves the figure and does not count as a move", () => {
    const state = act(initialState(), { type: "start" });
    const current = state.placements[0];
    if (!current) throw new Error("No first prop");
    const evaluation = evaluateState(state);
    const next = act(state, { type: "place", index: 0, x: current.x, y: current.y });
    expect(next).toBe(state);
    expect(next.moves).toBe(0);
    expect(evaluateState(next)).toBe(evaluation);
  });

  test("holding against every boundary stops counting and changing the figure", () => {
    let state = act(initialState(), { type: "start" });
    state = act(state, { type: "select", index: 1 });
    for (let i = 0; i < 80; i++) state = act(state, { type: "nudge", dx: 1, dy: -1, dz: 1 });
    expect(state.placements[1]).toMatchObject({
      x: LIMITS.maxX,
      y: PROPS.bowl.radius,
      z: LIMITS.maxZ,
    });
    expect(state.moves).toBeGreaterThan(0);
    expect(state.moves).toBeLessThan(80);
    expect(act(state, { type: "nudge", dx: 1, dy: -1, dz: 1 })).toBe(state);
    expect(act(state, { type: "nudge" })).toBe(state);
    const movedBack = act(state, { type: "nudge", dx: -1 });
    expect(movedBack.moves).toBe(state.moves + 1);
    expect(movedBack.placements[1]?.x).toBeCloseTo(LIMITS.maxX - STEP.xy);
  });

  test("an unchanged drag may select another prop without counting a move", () => {
    const state = act(initialState(), { type: "start" });
    const other = state.placements[1];
    if (!other) throw new Error("No second prop");
    const next = act(state, { type: "place", index: 1, x: other.x, y: other.y });
    expect(next.selected).toBe(1);
    expect(next.placements).toBe(state.placements);
    expect(next.moves).toBe(0);
  });
});

test("normal control steps tell all four stories, resist duplicate actions, and replay fully", () => {
  const playAll = (start: GameState) => {
    let state = start;
    const counts: number[] = [];
    for (const [index, chapter] of CHAPTERS.entries()) {
      expect(state).toMatchObject({ phase: "play", chapter: index, selected: 0, moves: 0 });
      expect(state.told).toHaveLength(index);
      expect(act(state, { type: "settle" })).toBe(state);
      expect(act(state, { type: "next" })).toBe(state);
      const earlierFigures = state.told.map((figure) => figure.slice());
      for (const action of controlRoute(chapter)) state = act(state, action);
      counts.push(state.moves);
      const evaluation = evaluateState(state);
      expect(evaluation.score).toBeGreaterThanOrEqual(chapter.pass);
      const playerFigure = normalise(evaluation.figure);
      state = act(state, { type: "settle" });
      expect(state.phase).toBe("told");
      expect(state.told).toHaveLength(index + 1);
      expect(state.told[index]).toEqual(playerFigure);
      expect(state.told[index]?.some((cell) => cell === 1)).toBe(true);
      expect(state.told.slice(0, index)).toEqual(earlierFigures);
      expect(act(state, { type: "settle" })).toBe(state);
      expect(act(state, { type: "nudge", dx: 1 })).toBe(state);
      expect(act(state, { type: "place", index: 0, x: LIMITS.maxX, y: LIMITS.maxY })).toBe(state);
      state = act(state, { type: "next" });
      expect(act(state, { type: "next" })).toBe(state);
    }
    expect(counts).toEqual([56, 67, 66, 121]);
    expect(state.phase).toBe("tableau");
    expect(state.told).toHaveLength(4);
    expect(act(state, { type: "settle" })).toBe(state);
    expect(act(state, { type: "reset" })).toBe(state);
    return state;
  };

  let start = act(initialState(), { type: "start" });
  start = act(start, { type: "nudge", dx: 1 });
  start = act(start, { type: "hint" });
  start = act(start, { type: "hint" });
  start = act(start, { type: "reset" });
  expect(start.placements).toEqual(chapterAt(0).props.map((prop) => prop.start));
  expect(start.hintLevel).toBe(2);
  expect(start.moves).toBe(0);
  const first = playAll(start);
  const firstFigures = first.told.map((figure) => figure.slice());
  const replay = act(first, { type: "replay" });
  expect(replay).toMatchObject({ phase: "play", chapter: 0, selected: 0, hintLevel: 0, moves: 0 });
  expect(replay.told).toEqual([]);
  expect(replay.placements).not.toBe(first.placements);
  expect(act(replay, { type: "replay" })).toBe(replay);
  const second = playAll(replay);
  expect(second.told).toEqual(firstFigures);
  expect(second.told[0]).not.toBe(first.told[0]);
  expect(first.told).toEqual(firstFigures);
});
