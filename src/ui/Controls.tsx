import type { ReactNode } from "react";
import type { Action } from "../game/state";
import { HoldButton } from "./HoldButton";

// Prop picker and the control pad. Every control is a labelled button with a key shortcut.

type Nudge = Extract<Action, { type: "nudge" }>;

const PAD: {
  label: string;
  glyph: string;
  key: string;
  shortcut: string;
  nudge: Omit<Nudge, "type">;
  wide?: boolean;
}[] = [
  { label: "Move shadow left", glyph: "←", key: "←", shortcut: "ArrowLeft", nudge: { dx: -1 } },
  { label: "Move shadow up", glyph: "↑", key: "↑", shortcut: "ArrowUp", nudge: { dy: 1 } },
  { label: "Move shadow down", glyph: "↓", key: "↓", shortcut: "ArrowDown", nudge: { dy: -1 } },
  { label: "Move shadow right", glyph: "→", key: "→", shortcut: "ArrowRight", nudge: { dx: 1 } },
  {
    label: "Bigger shadow (toward the lamp)",
    glyph: "Bigger",
    key: "+",
    shortcut: "+ =",
    nudge: { dz: 1 },
    wide: true,
  },
  {
    label: "Smaller shadow (toward the tent)",
    glyph: "Smaller",
    key: "−",
    shortcut: "- _",
    nudge: { dz: -1 },
    wide: true,
  },
  {
    label: "Turn the prop",
    glyph: "Turn ↻",
    key: "Q / E",
    shortcut: "Q E",
    nudge: { turn: 1 },
    wide: true,
  },
  { label: "Tilt left", glyph: "Tilt ↶", key: "Z", shortcut: "Z", nudge: { tilt: 1 }, wide: true },
  {
    label: "Tilt right",
    glyph: "Tilt ↷",
    key: "X",
    shortcut: "X",
    nudge: { tilt: -1 },
    wide: true,
  },
];

export function Controls({
  names,
  selected,
  dispatch,
  hintLevel,
  guide,
  disabled = false,
}: {
  names: readonly string[];
  selected: number;
  dispatch: (a: Action) => void;
  hintLevel: number;
  guide?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <section aria-label="Props and controls" className="panel controls" inert={disabled}>
      {guide}
      <p id="selected-prop" className="sr-only-text" role="status">
        Selected prop: {names[selected] ?? "prop"}
      </p>
      <fieldset className="prop-picker" disabled={disabled}>
        <legend className="sr-only-text">Choose a prop</legend>
        {names.map((name, i) => (
          <button
            key={name}
            type="button"
            aria-pressed={i === selected}
            aria-keyshortcuts={String(i + 1)}
            data-prop={i}
            className="chip"
            title={`${name} (${i + 1})`}
            onClick={() => dispatch({ type: "select", index: i })}
          >
            <span className="chip-key" aria-hidden="true">
              {i + 1}
            </span>
            {name}
          </button>
        ))}
      </fieldset>
      <fieldset className="pad" aria-describedby="selected-prop" disabled={disabled}>
        <legend className="sr-only-text">Move the {names[selected] ?? "prop"}</legend>
        {PAD.map((b) => (
          <HoldButton
            key={b.label}
            label={b.label}
            keyHint={b.key}
            keyShortcut={b.shortcut}
            disabled={disabled}
            identity={selected}
            className={b.wide ? "pad-wide" : ""}
            onPress={() => dispatch({ type: "nudge", ...b.nudge })}
          >
            {b.glyph}
          </HoldButton>
        ))}
        <button
          type="button"
          className="pad-btn pad-wide pad-quiet"
          title="Hint (H)"
          aria-keyshortcuts="H"
          aria-label={
            hintLevel >= 2
              ? "Hints shown"
              : hintLevel === 1
                ? "Trace the sketch on the tent"
                : "Hint"
          }
          disabled={hintLevel >= 2}
          onClick={() => dispatch({ type: "hint" })}
        >
          {hintLevel === 0 ? "Hint" : hintLevel === 1 ? "Trace it" : "Traced"}
        </button>
        <button
          type="button"
          className="pad-btn pad-wide pad-quiet"
          title="Reset this story (R)"
          aria-keyshortcuts="R"
          aria-label="Reset props to the start"
          onClick={() => dispatch({ type: "reset" })}
        >
          Reset
        </button>
      </fieldset>
    </section>
  );
}
