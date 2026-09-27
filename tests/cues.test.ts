import { describe, expect, test } from "bun:test";
import { cuesFor, likenessStep, pickCue } from "../src/audio/cues";
import { chapterAt, type GameState, initialState, reduce } from "../src/game/state";

const kinds = chapterAt(0).props.map((p) => p.kind);
const radius = () => 0.25;
const play = reduce(initialState(), { type: "start" }, radius);

function step(state: GameState, action: Parameters<typeof reduce>[1]) {
  const after = reduce(state, action, radius);
  return { after, cues: cuesFor(action, state, after, kinds, null).map((c) => c.name) };
}

describe("sound cues", () => {
  test("lighting the lamp and each manipulation has its own sound", () => {
    expect(cuesFor({ type: "start" }, initialState(), play, kinds, null)).toEqual([
      { name: "lamp" },
    ]);
    expect(step(play, { type: "nudge", dx: 1 }).cues).toEqual(["tick"]);
    expect(step(play, { type: "nudge", dz: 1 }).cues).toEqual(["depth"]);
    expect(step(play, { type: "nudge", turn: 1 }).cues).toEqual(["turn"]);
    expect(step(play, { type: "nudge", tilt: -1 }).cues).toEqual(["tilt"]);
    expect(step(play, { type: "reset" }).cues).toEqual(["reset"]);
  });

  test("picking a prop sounds like its material", () => {
    expect(step(play, { type: "select", index: 1 }).cues).toEqual(["pick-enamel"]);
    expect(pickCue("boot").name).toBe("pick-leather");
    expect(pickCue("spoon").name).toBe("pick-wood");
  });

  test("hints escalate from a question to a chalk scratch", () => {
    const one = step(play, { type: "hint" });
    expect(one.cues).toEqual(["hint"]);
    expect(step(one.after, { type: "hint" }).cues).toEqual(["trace"]);
  });

  test("no-ops make no sound", () => {
    const title = initialState();
    const same = reduce(title, { type: "nudge", dx: 1 }, radius);
    expect(same).toBe(title);
    expect(cuesFor({ type: "nudge", dx: 1 }, title, same, kinds, null)).toEqual([]);
  });

  test("a rising likeness ticks higher, and nearing the pass mark chimes", () => {
    expect(likenessStep(0, 0.8)).toBe(0);
    expect(likenessStep(0.8, 0.8)).toBe(5);
    const rising = cuesFor({ type: "nudge", dx: 1 }, play, { ...play }, kinds, {
      before: 0.2,
      after: 0.45,
      pass: 0.8,
    });
    expect(rising.map((c) => c.name)).toEqual(["tick", "tick"]);
    expect(rising[1]?.rate).toBeGreaterThan(1);
    const close = cuesFor({ type: "nudge", dx: 1 }, play, { ...play }, kinds, {
      before: 0.6,
      after: 0.75,
      pass: 0.8,
    });
    expect(close.map((c) => c.name)).toContain("close");
  });
});
