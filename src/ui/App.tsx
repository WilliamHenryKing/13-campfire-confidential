import { useEffect, useMemo, useState } from "react";
import type { SoundEngine } from "../audio/engine";
import { normalise } from "../game/compare";
import { chapterAt, evaluateState, targetFor } from "../game/state";
import { adviceText, propNames } from "../game/words";
import { CoachTip, EndingCard, LAST_CHAPTER, TitleCard, ToldCard } from "./Cards";
import { Controls } from "./Controls";
import { MuteButton } from "./MuteButton";
import { StoryCard } from "./StoryCard";
import { type Store, useGame } from "./store";

// The HUD over the scene, plus the keyboard map.

const COACH_KEY = "campfire-confidential:coached";

function readCoached(): boolean {
  try {
    return window.localStorage.getItem(COACH_KEY) === "1";
  } catch {
    return false;
  }
}

export function App({ store, sound }: { store: Store; sound: SoundEngine }) {
  const state = useGame(store);
  const { dispatch } = store;
  const chapter = chapterAt(state.chapter);
  const names = useMemo(() => propNames(chapter.props.map((p) => p.kind)), [chapter]);
  const sketch = useMemo(() => normalise(targetFor(chapter).figure), [chapter]);
  const ev = evaluateState(state);
  const [coached, setCoached] = useState(readCoached);

  const dismissCoach = () => {
    sound.play("click");
    setCoached(true);
    try {
      window.localStorage.setItem(COACH_KEY, "1");
    } catch {
      // Private mode: the tip simply returns next visit.
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "m" || e.key === "M") {
        sound.setMuted(!sound.muted);
        return;
      }
      const s = store.get();
      if (s.phase !== "play") return;
      const n = Number.parseInt(e.key, 10);
      const map: Record<string, () => void> = {
        ArrowLeft: () => dispatch({ type: "nudge", dx: -1 }),
        ArrowRight: () => dispatch({ type: "nudge", dx: 1 }),
        ArrowUp: () => dispatch({ type: "nudge", dy: 1 }),
        ArrowDown: () => dispatch({ type: "nudge", dy: -1 }),
        "+": () => dispatch({ type: "nudge", dz: 1 }),
        "=": () => dispatch({ type: "nudge", dz: 1 }),
        "-": () => dispatch({ type: "nudge", dz: -1 }),
        _: () => dispatch({ type: "nudge", dz: -1 }),
        q: () => dispatch({ type: "nudge", turn: 1 }),
        e: () => dispatch({ type: "nudge", turn: -1 }),
        z: () => dispatch({ type: "nudge", tilt: 1 }),
        x: () => dispatch({ type: "nudge", tilt: -1 }),
        h: () => dispatch({ type: "hint" }),
        r: () => dispatch({ type: "reset" }),
        ",": () => dispatch({ type: "cycle", step: -1 }),
        ".": () => dispatch({ type: "cycle", step: 1 }),
      };
      const fn = map[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (fn) {
        e.preventDefault();
        fn();
      } else if (n >= 1 && n <= s.placements.length) {
        dispatch({ type: "select", index: n - 1 });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, dispatch, sound]);

  const showCoach = state.phase === "play" && state.chapter === 0 && !coached;

  return (
    <div className="hud">
      <MuteButton sound={sound} />
      {state.phase === "title" && <TitleCard onStart={() => dispatch({ type: "start" })} />}
      {(state.phase === "play" || state.phase === "told") && (
        <StoryCard
          chapter={chapter}
          index={state.chapter}
          sketch={sketch}
          score={ev.score}
          advice={state.hintLevel > 0 ? adviceText(ev.advice, names) : null}
        />
      )}
      {state.phase === "play" && (
        <>
          {showCoach && <CoachTip onDismiss={dismissCoach} />}
          <Controls
            names={names}
            selected={state.selected}
            dispatch={dispatch}
            hintLevel={state.hintLevel}
          />
        </>
      )}
      {state.phase === "told" && (
        <ToldCard
          chapter={chapter}
          last={state.chapter === LAST_CHAPTER}
          onNext={() => dispatch({ type: "next" })}
        />
      )}
      {state.phase === "tableau" && <EndingCard onReplay={() => dispatch({ type: "replay" })} />}
    </div>
  );
}
