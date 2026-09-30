import { useEffect, useRef } from "react";
import "./opening.css";

export function Title({ onBegin }: { onBegin(): void }) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => button.current?.focus(), []);
  return (
    <section className="opening" aria-labelledby="opening-title">
      <div className="opening-copy">
        <p className="opening-eyebrow">Camp Pinecone · after lights out</p>
        <h1 id="opening-title">
          Campfire
          <br />
          <em>Confidential.</em>
        </h1>
        <p className="opening-premise">
          Four campers. One lantern.
          <br />
          Everybody has a shadow to tell.
        </p>
        <button ref={button} type="button" className="cta" onClick={onBegin}>
          Light the lamp
        </button>
        <span className="enter-note">or press Enter</span>
      </div>
      <p className="opening-note" aria-hidden="true">
        A bowl, a boot, a suspicious pinecone.
        <br />
        All evidence stays at camp.
      </p>
    </section>
  );
}

export function Guide({ step, onSkip }: { step: number; onSkip(): void }) {
  const touch = matchMedia("(pointer: coarse)").matches;
  const steps = [
    [
      "Move the shadow",
      touch
        ? "Choose a prop below, then use the arrow buttons or drag it in front of the tent. Watch its shadow follow."
        : "Choose a prop below, then drag it or use the arrow keys. Watch its shadow move across the canvas.",
    ],
    [
      "Change its silhouette",
      touch
        ? "Try Bigger, Smaller, Turn or Tilt. Moving a prop closer to the lantern makes a larger shadow."
        : "Try Bigger / Smaller (+ −), Turn (Q E) or Tilt (Z X). Closer to the lantern means a larger shadow.",
    ],
    [
      "Tell the secret",
      "Make your shadows resemble the story sketch. Every prop takes part. Pause when it looks right; Hint and Trace it can help.",
    ],
  ];
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users must be able to scroll the bounded landscape guide.
    <aside className="shadow-guide" aria-label="Shadow guide" aria-live="polite" tabIndex={0}>
      <div>
        <p className="opening-eyebrow">
          {step + 1}/3 · {steps[step]?.[0]}
        </p>
        <p>{steps[step]?.[1]}</p>
      </div>
      <button type="button" onClick={onSkip}>
        Skip the guide
      </button>
    </aside>
  );
}
