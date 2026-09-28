import { createRoot } from "react-dom/client";
import { cuesFor } from "./audio/cues";
import { createSoundEngine } from "./audio/engine";
import { normalise } from "./game/compare";
import { PROPS } from "./game/props";
import { chapterAt, evaluateState, type GameState, targetFor } from "./game/state";
import { worldReady } from "./loader";
import { createWorld } from "./scene/world";
import { App } from "./ui/App";
import { createStore } from "./ui/store";
import { installVisualTest, wantsVisualTest } from "./visual-test";
import "./ui/styles.css";

// Wiring: one store drives both the three.js world and the React HUD.

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (reducedMotion) document.documentElement.classList.add("reduced-motion");

const store = createStore(
  (state, i) => PROPS[chapterAt(state.chapter).props[i]?.kind ?? "thermos"].radius,
);

// Every dispatch passes through here so the sound follows the game.
const sound = createSoundEngine(reducedMotion);
const rawDispatch = store.dispatch;
store.dispatch = (action) => {
  const before = store.get();
  const scoreBefore = before.phase === "play" ? evaluateState(before).score : 0;
  rawDispatch(action);
  const after = store.get();
  const chapter = chapterAt(after.chapter);
  const scores =
    after.phase === "play" && before.chapter === after.chapter && before.phase === "play"
      ? { before: scoreBefore, after: evaluateState(after).score, pass: chapter.pass }
      : null;
  const kinds = chapter.props.map((p) => p.kind);
  for (const cue of cuesFor(action, before, after, kinds, scores)) sound.play(cue.name, cue);
  if (action.type === "start" || action.type === "replay") sound.begin();
  sound.setMood(after.phase === "tableau" ? 0 : 1);
};

const sceneHost = document.createElement("div");
sceneHost.className = "scene";
document.body.prepend(sceneHost);

const world = createWorld(sceneHost, reducedMotion);
let interacting = false;
let settleTimer = 0;
/** Set by the capture hook: a posed scene must not tell itself. */
let capturing = false;

function scheduleSettle() {
  if (capturing) return;
  window.clearTimeout(settleTimer);
  settleTimer = window.setTimeout(() => {
    if (!interacting) store.dispatch({ type: "settle" });
  }, 420);
}

world.bind({
  depthOf: (i) => store.get().placements[i]?.z ?? 1,
  positionOf: (i) => {
    const p = store.get().placements[i];
    return { x: p?.x ?? 0, y: p?.y ?? 0 };
  },
  select: (i) => {
    if (store.get().phase !== "play") return;
    interacting = true;
    sound.play("grab");
    store.dispatch({ type: "select", index: i });
  },
  drag: (i, x, y) => store.dispatch({ type: "place", index: i, x, y }),
  depth: (steps) => store.dispatch({ type: "nudge", dz: steps }),
  release: () => {
    if (interacting) sound.play("settle");
    interacting = false;
    scheduleSettle();
  },
});

let shown: { chapter: number; phase: GameState["phase"] } | null = null;
let lastPlacements: GameState["placements"] | null = null;
let lastTrace = "";

function render(state: GameState) {
  const chapter = chapterAt(state.chapter);
  const phaseChanged = !shown || shown.phase !== state.phase;
  if (!shown || shown.chapter !== state.chapter || shown.phase === "tableau")
    world.showProps(chapter.props.map((p) => p.kind));
  if (state.phase === "tableau") {
    if (phaseChanged) {
      const n = reducedMotion ? 1 : state.told.length;
      for (let k = 0; k < n; k++)
        window.setTimeout(
          () => sound.play("paint", { rate: 0.9 + k * 0.06 }),
          reducedMotion ? 0 : 500 + (k * 3200) / n,
        );
      world.tableau(
        state.told,
        state.told.map((_, k) => chapterAt(k).title),
      );
    }
  } else {
    world.sync(state.placements, state.selected, state.phase === "play");
    const ev = evaluateState(state);
    const traceKey = `${state.hintLevel}|${state.phase}|${ev.figure.cx}|${ev.figure.cy}|${ev.figure.scale}|${ev.mirror}`;
    if (traceKey !== lastTrace) {
      lastTrace = traceKey;
      const on = state.phase === "play" && state.hintLevel >= 2 && ev.figure.count > 0;
      world.trace(
        on ? normalise(targetFor(chapter).figure) : null,
        on
          ? { cx: ev.figure.cx, cy: ev.figure.cy, scale: ev.figure.scale, mirror: ev.mirror }
          : null,
      );
    }
    if (phaseChanged && state.phase === "told")
      world.reveal(chapter.id, normalise(targetFor(chapter).figure), {
        cx: ev.figure.cx,
        cy: ev.figure.cy,
        scale: ev.figure.scale,
        mirror: ev.mirror,
      });
    if (
      state.phase === "play" &&
      lastPlacements &&
      state.placements !== lastPlacements &&
      !interacting
    )
      scheduleSettle();
  }
  lastPlacements = state.placements;
  shown = { chapter: state.chapter, phase: state.phase };
}

store.subscribe(() => render(store.get()));
render(store.get());

const root = document.getElementById("root");
if (root) createRoot(root).render(<App store={store} sound={sound} />);
let firstFrame: () => void = () => {};
const drawn = new Promise<void>((done) => {
  firstFrame = done;
});
world.start(() => {
  worldReady();
  firstFrame();
});
if (wantsVisualTest())
  installVisualTest(
    world,
    store,
    Promise.all([drawn, world.loaded]).then(() => undefined),
    (on) => {
      capturing = on;
    },
  );
