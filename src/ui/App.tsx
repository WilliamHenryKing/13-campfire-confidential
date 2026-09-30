import { useEffect, useMemo, useRef, useState } from "react";
import type { SoundEngine } from "../audio/engine";
import { normalise } from "../game/compare";
import { chapterAt, evaluateState, targetFor } from "../game/state";
import { adviceText, propNames } from "../game/words";
import type { OpeningPhase } from "../scene/opening";
import type { World } from "../scene/world";
import { EndingCard, LAST_CHAPTER, ToldCard } from "./Cards";
import { Controls } from "./Controls";
import { focusProp } from "./focus";
import { MuteButton } from "./MuteButton";
import { Guide, Title } from "./Opening";
import { StoryCard } from "./StoryCard";
import { type Store, useGame } from "./store";

const GUIDE_KEY = "campfire-confidential:guide-v1";
function firstGuide() {
  try {
    return localStorage.getItem(GUIDE_KEY) === "1" ? -1 : 0;
  } catch {
    return 0;
  }
}
function rememberGuide() {
  try {
    localStorage.setItem(GUIDE_KEY, "1");
  } catch {
    /* Private storage. */
  }
}

export function App({ store, sound, world }: { store: Store; sound: SoundEngine; world: World }) {
  const state = useGame(store);
  const { dispatch } = store;
  const chapter = chapterAt(state.chapter);
  const names = useMemo(() => propNames(chapter.props.map((p) => p.kind)), [chapter]);
  const sketch = useMemo(() => normalise(targetFor(chapter).figure), [chapter]);
  const ev = evaluateState(state);
  const [opening, setOpening] = useState<OpeningPhase>(world.opening.phase);
  const [guide, setGuide] = useState(firstGuide);
  const [curtain, setCurtain] = useState(false);
  const busy = useRef(false);
  const timers = useRef(new Set<number>());

  useEffect(() => {
    world.opening.onDone = () => {
      setOpening("done");
      dispatch({ type: "start" });
    };
    return () => {
      world.opening.onDone = null;
      for (const timer of timers.current) clearTimeout(timer);
    };
  }, [world, dispatch]);

  useEffect(() => {
    let before = store.get();
    return store.subscribe(() => {
      const next = store.get();
      if (next.phase === "told") {
        rememberGuide();
        setGuide(-1);
      } else if (
        before.phase === "play" &&
        next.phase === "play" &&
        before.chapter === next.chapter
      ) {
        const moved = next.placements.some(
          (p, i) => p.x !== before.placements[i]?.x || p.y !== before.placements[i]?.y,
        );
        const shaped = next.placements.some(
          (p, i) =>
            p.z !== before.placements[i]?.z ||
            p.turn !== before.placements[i]?.turn ||
            p.tilt !== before.placements[i]?.tilt,
        );
        setGuide((step) => (step === 0 && moved ? 1 : step === 1 && shaped ? 2 : step));
      }
      before = next;
    });
  }, [store]);

  useEffect(() => {
    if (opening !== "done" || state.phase !== "play" || curtain) return;
    const frame = requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(".chip[aria-pressed='true']")?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [opening, state.phase, curtain]);

  useEffect(() => {
    world.setInteractive(opening === "done" && state.phase === "play" && !curtain);
  }, [world, opening, state.phase, curtain]);

  const later = (fn: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      fn();
    }, delay);
    timers.current.add(timer);
  };
  const turnPage = (action: "next" | "replay") => {
    if (busy.current) return;
    busy.current = true;
    world.setInteractive(false);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dispatch({ type: action });
      busy.current = false;
      return;
    }
    setCurtain(true);
    later(() => {
      dispatch({ type: action });
      later(() => {
        setCurtain(false);
        busy.current = false;
      }, 80);
    }, 480);
  };
  const skipGuide = () => {
    rememberGuide();
    setGuide(-1);
    later(() => focusProp(store.get().selected), 0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        busy.current ||
        world.opening.phase !== "done"
      )
        return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input,textarea,select,[contenteditable='true']")) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key.startsWith("Arrow") && target?.closest(".story, .shadow-guide")) return;
      if (key === "m") {
        if (!e.repeat) sound.setMuted(!sound.muted);
        return;
      }
      const s = store.get();
      if (s.phase !== "play") return;
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
        h: () => {
          if (!e.repeat) dispatch({ type: "hint" });
        },
        r: () => {
          if (!e.repeat) dispatch({ type: "reset" });
        },
        ",": () => {
          dispatch({ type: "cycle", step: -1 });
          focusProp(store.get().selected);
        },
        ".": () => {
          dispatch({ type: "cycle", step: 1 });
          focusProp(store.get().selected);
        },
      };
      const fn = map[key];
      if (fn) {
        e.preventDefault();
        fn();
      } else if (/^[1-4]$/.test(key) && Number(key) <= s.placements.length) {
        e.preventDefault();
        dispatch({ type: "select", index: Number(key) - 1 });
        focusProp(store.get().selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, dispatch, sound, world]);

  return (
    <div className="hud" data-opening={opening} data-phase={state.phase}>
      <div
        className="sound-wrap"
        inert={curtain || state.phase === "told" || state.phase === "tableau"}
      >
        <MuteButton sound={sound} />
      </div>
      <div className={curtain ? "curtain is-on" : "curtain"} aria-hidden="true" />
      {opening === "title" && (
        <Title
          onBegin={() => {
            sound.begin();
            sound.play("lamp");
            world.opening.begin(matchMedia("(prefers-reduced-motion: reduce)").matches);
            setOpening(world.opening.phase);
          }}
        />
      )}
      {(state.phase === "play" || state.phase === "told") && (
        <StoryCard
          inert={curtain || state.phase === "told"}
          chapter={chapter}
          index={state.chapter}
          sketch={sketch}
          score={ev.score}
          advice={
            state.phase === "told"
              ? "Secret told. Your shadow is saved."
              : state.hintLevel > 0
                ? adviceText(ev.advice, names)
                : null
          }
        />
      )}
      {state.phase === "play" && (
        <Controls
          disabled={curtain || opening !== "done"}
          names={names}
          selected={state.selected}
          dispatch={(action) => {
            if (!busy.current) dispatch(action);
          }}
          hintLevel={state.hintLevel}
          guide={
            guide >= 0 ? (
              <Guide step={guide} onSkip={skipGuide} />
            ) : (
              <button
                type="button"
                className="guide-replay"
                aria-label="Replay the guide"
                onClick={() => {
                  setGuide(0);
                  later(() => focusProp(store.get().selected), 0);
                }}
              >
                How to play · ?
              </button>
            )
          }
        />
      )}
      {state.phase === "told" && (
        <ToldCard
          sound={sound}
          chapter={chapter}
          last={state.chapter === LAST_CHAPTER}
          onNext={() => turnPage("next")}
        />
      )}
      {state.phase === "tableau" && (
        <EndingCard sound={sound} onReplay={() => turnPage("replay")} />
      )}
    </div>
  );
}
