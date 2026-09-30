import { CHAPTERS, type Chapter, LIMITS } from "./chapters";
import { normalise } from "./compare";
import { buildTarget, type Evaluation, evaluate, type PlacedProp, type Target } from "./hints";
import type { Placement } from "./types";

// The whole game as a pure reducer: title → chapters → tableau → replay.

export type Phase = "title" | "play" | "told" | "tableau";

export interface GameState {
  phase: Phase;
  chapter: number;
  placements: Placement[];
  selected: number;
  /** 0 none, 1 spoken advice, 2 advice plus the sketch traced on the tent. */
  hintLevel: number;
  /** Normalised figures the player made, one per finished chapter, for the tableau. */
  told: Uint8Array[];
  moves: number;
}

export type Action =
  | { type: "start" }
  | { type: "select"; index: number }
  | { type: "cycle"; step: 1 | -1 }
  | { type: "place"; index: number; x: number; y: number }
  | { type: "nudge"; dx?: number; dy?: number; dz?: number; turn?: number; tilt?: number }
  | { type: "hint" }
  | { type: "reset" }
  | { type: "settle" }
  | { type: "next" }
  | { type: "replay" };

export const STEP = { xy: 0.04, z: 0.15 } as const;

const targets = new Map<string, Target>();

export function chapterAt(index: number): Chapter {
  const ch = CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, index))];
  if (!ch) throw new Error("No chapters defined");
  return ch;
}

export function targetFor(chapter: Chapter): Target {
  let t = targets.get(chapter.id);
  if (!t) {
    t = buildTarget(chapter.props.map((p) => ({ kind: p.kind, at: p.solution })));
    targets.set(chapter.id, t);
  }
  return t;
}

export function placedProps(state: GameState): PlacedProp[] {
  const ch = chapterAt(state.chapter);
  return ch.props.map((p, i) => ({ kind: p.kind, at: state.placements[i] ?? p.start }));
}

let lastEval: { placements: Placement[]; chapter: number; ev: Evaluation } | null = null;

/** Evaluate the current figure; cached on the placements array, which actions replace. */
export function evaluateState(state: GameState): Evaluation {
  if (lastEval && lastEval.placements === state.placements && lastEval.chapter === state.chapter)
    return lastEval.ev;
  const ev = evaluate(placedProps(state), targetFor(chapterAt(state.chapter)));
  lastEval = { placements: state.placements, chapter: state.chapter, ev };
  return ev;
}

function wrap(n: number, m: number) {
  return ((n % m) + m) % m;
}

export function clampPlacement(p: Placement, radius: number): Placement {
  return {
    x: Math.min(LIMITS.maxX, Math.max(LIMITS.minX, p.x)),
    y: Math.min(LIMITS.maxY, Math.max(radius, p.y)),
    z: Math.min(LIMITS.maxZ, Math.max(LIMITS.minZ, p.z)),
    turn: wrap(Math.round(p.turn), 8),
    tilt: wrap(Math.round(p.tilt), 24),
  };
}

function startPlacements(chapter: number): Placement[] {
  return chapterAt(chapter).props.map((p) => ({ ...p.start }));
}

export function initialState(): GameState {
  return {
    phase: "title",
    chapter: 0,
    placements: startPlacements(0),
    selected: 0,
    hintLevel: 0,
    told: [],
    moves: 0,
  };
}

function enterChapter(state: GameState, chapter: number): GameState {
  return {
    ...state,
    phase: "play",
    chapter,
    placements: startPlacements(chapter),
    selected: 0,
    hintLevel: 0,
    moves: 0,
  };
}

function edit(state: GameState, index: number, fn: (p: Placement) => Placement, radius: number) {
  const current = state.placements[index];
  if (state.phase !== "play" || !current) return state;
  const next = clampPlacement(fn(current), radius);
  if (
    next.x === current.x &&
    next.y === current.y &&
    next.z === current.z &&
    next.turn === current.turn &&
    next.tilt === current.tilt
  )
    return state.selected === index ? state : { ...state, selected: index };
  const placements = state.placements.slice();
  placements[index] = next;
  return { ...state, placements, selected: index, moves: state.moves + 1 };
}

/** radiusOf lets the reducer stay independent of prop geometry lookups in tests. */
export function reduce(
  state: GameState,
  action: Action,
  radiusOf: (i: number) => number,
): GameState {
  switch (action.type) {
    case "start":
      return state.phase === "title" ? enterChapter(state, 0) : state;
    case "select":
      if (action.index < 0 || action.index >= state.placements.length) return state;
      return { ...state, selected: action.index };
    case "cycle":
      return { ...state, selected: wrap(state.selected + action.step, state.placements.length) };
    case "place":
      return edit(
        state,
        action.index,
        (p) => ({ ...p, x: action.x, y: action.y }),
        radiusOf(action.index),
      );
    case "nudge":
      return edit(
        state,
        state.selected,
        (p) => ({
          x: p.x + (action.dx ?? 0) * STEP.xy,
          y: p.y + (action.dy ?? 0) * STEP.xy,
          z: p.z + (action.dz ?? 0) * STEP.z,
          turn: p.turn + (action.turn ?? 0),
          tilt: p.tilt + (action.tilt ?? 0),
        }),
        radiusOf(state.selected),
      );
    case "hint":
      return state.phase === "play"
        ? { ...state, hintLevel: Math.min(2, state.hintLevel + 1) }
        : state;
    case "reset":
      return state.phase === "play"
        ? { ...state, placements: startPlacements(state.chapter), moves: 0 }
        : state;
    case "settle": {
      if (state.phase !== "play") return state;
      const ev = evaluateState(state);
      if (ev.score < chapterAt(state.chapter).pass) return state;
      const told = state.told.slice(0, state.chapter);
      told[state.chapter] = normalise(ev.figure);
      return { ...state, phase: "told", told };
    }
    case "next":
      if (state.phase !== "told") return state;
      if (state.chapter + 1 >= CHAPTERS.length) return { ...state, phase: "tableau" };
      return enterChapter(state, state.chapter + 1);
    case "replay":
      return state.phase === "tableau" ? enterChapter(initialState(), 0) : state;
  }
}
