import { createRoot } from "react-dom/client";
import { normalise } from "./game/compare";
import { PROPS } from "./game/props";
import { chapterAt, evaluateState, type GameState, targetFor } from "./game/state";
import { worldReady } from "./loader";
import { createWorld } from "./scene/world";
import { App } from "./ui/App";
import { createStore } from "./ui/store";
import "./ui/styles.css";

// Wiring: one store drives both the three.js world and the React HUD.

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (reducedMotion) document.documentElement.classList.add("reduced-motion");

const store = createStore(
  (state, i) => PROPS[chapterAt(state.chapter).props[i]?.kind ?? "thermos"].radius,
);

const sceneHost = document.createElement("div");
sceneHost.className = "scene";
document.body.prepend(sceneHost);

const world = createWorld(sceneHost, reducedMotion);
let interacting = false;
let settleTimer = 0;

function scheduleSettle() {
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
    store.dispatch({ type: "select", index: i });
  },
  drag: (i, x, y) => store.dispatch({ type: "place", index: i, x, y }),
  depth: (steps) => store.dispatch({ type: "nudge", dz: steps }),
  release: () => {
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
    if (phaseChanged)
      world.tableau(
        state.told,
        state.told.map((_, k) => chapterAt(k).title),
      );
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
if (root) createRoot(root).render(<App store={store} />);
world.start(() => worldReady());
