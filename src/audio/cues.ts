import type { Action, GameState } from "../game/state";
import type { PropKind } from "../game/types";
import type { Sfx } from "./engine";

// Which sounds a game step deserves. Pure, so the mapping is unit-tested.

export interface Cue {
  name: Sfx;
  rate?: number;
  gain?: number;
}

const PICK: Record<PropKind, Sfx> = {
  thermos: "pick-metal",
  kettle: "pick-metal",
  pan: "pick-metal",
  bowl: "pick-enamel",
  spoon: "pick-wood",
  pinecone: "pick-wood",
  boot: "pick-leather",
};

export function pickCue(kind: PropKind): Cue {
  return { name: PICK[kind] };
}

/** Likeness in fifths of the pass mark, so the tick climbs as the figure forms. */
export function likenessStep(score: number, pass: number): number {
  return Math.max(0, Math.min(5, Math.floor((score / pass) * 5)));
}

export interface Scores {
  before: number;
  after: number;
  pass: number;
}

export function cuesFor(
  action: Action,
  before: GameState,
  after: GameState,
  kinds: readonly PropKind[],
  scores: Scores | null,
): Cue[] {
  if (after === before) return [];
  const out: Cue[] = [];
  switch (action.type) {
    case "start":
      out.push({ name: "lamp" });
      break;
    case "select":
    case "cycle": {
      const kind = kinds[after.selected];
      if (kind && after.selected !== before.selected) out.push(pickCue(kind));
      break;
    }
    case "nudge":
      if (action.turn) out.push({ name: "turn" });
      else if (action.tilt) out.push({ name: "tilt" });
      else if (action.dz) out.push({ name: "depth", rate: action.dz > 0 ? 1.1 : 0.9 });
      else out.push({ name: "tick" });
      break;
    case "hint":
      out.push({ name: after.hintLevel >= 2 ? "trace" : "hint" });
      break;
    case "reset":
      out.push({ name: "reset" });
      break;
    case "settle":
      if (after.phase === "told") out.push({ name: "told" });
      break;
    case "next":
      out.push(after.phase === "tableau" ? { name: "finale" } : { name: "page" });
      break;
    case "replay":
      out.push({ name: "page" }, { name: "lamp" });
      break;
    case "place":
      break;
  }
  if (scores && after.phase === "play") {
    const a = likenessStep(scores.before, scores.pass);
    const b = likenessStep(scores.after, scores.pass);
    const wasClose = scores.before >= scores.pass - 0.08;
    const isClose = scores.after >= scores.pass - 0.08;
    if (isClose && !wasClose) out.push({ name: "close" });
    else if (b > a) out.push({ name: "tick", rate: 1 + 0.15 * b, gain: 1.6 });
  }
  return out;
}
