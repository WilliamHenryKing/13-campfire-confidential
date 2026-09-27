import { useEffect, useRef, useState } from "react";
import { CHAPTERS, type Chapter } from "../game/chapters";

// Title, "told" and ending cards, plus the first-time coach tip. Each moves focus to its
// main action so keyboard players never have to hunt for it.

function useAutoFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => ref.current?.focus(), []);
  return ref;
}

export function TitleCard({ onStart }: { onStart: () => void }) {
  const button = useAutoFocus<HTMLButtonElement>();
  return (
    <section className="card card-center" aria-labelledby="title">
      <p className="eyebrow">Camp Pinecone · after lights out</p>
      <h1 id="title" className="title">
        Campfire Confidential
      </h1>
      <p className="lede">
        At Camp Pinecone every secret must be told in shadows. Hang the camp's odds and ends in
        front of the lantern until their shadows on the tent tell the story.
      </p>
      <button ref={button} type="button" className="cta" onClick={onStart}>
        Light the lamp
      </button>
    </section>
  );
}

const REDUCED =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Split a told line into sentences, revealed one after another. */
export function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean);
}

export function ToldCard({
  chapter,
  last,
  onNext,
}: {
  chapter: Chapter;
  last: boolean;
  onNext: () => void;
}) {
  const button = useAutoFocus<HTMLButtonElement>();
  const lines = sentences(chapter.told);
  const [shown, setShown] = useState(REDUCED ? lines.length : 0);
  useEffect(() => {
    if (shown >= lines.length) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 900 : 1300);
    return () => window.clearTimeout(t);
  }, [shown, lines.length]);
  return (
    <section className="card card-told" aria-labelledby="told-title">
      <p className="eyebrow">Secret told · {chapter.teller}</p>
      <h2 id="told-title" className="story-title">
        {chapter.title}
      </h2>
      <p className="lede told-lines" aria-live="polite">
        {lines.map((line, i) => (
          <span
            key={line}
            className={i < shown ? "line is-shown" : "line"}
            aria-hidden={i >= shown}
          >
            {line}{" "}
          </span>
        ))}
      </p>
      <button ref={button} type="button" className="cta" onClick={onNext}>
        {last ? "Close the case" : "Next story"}
      </button>
    </section>
  );
}

export function EndingCard({ onReplay }: { onReplay: () => void }) {
  const button = useAutoFocus<HTMLButtonElement>();
  return (
    <section className="card card-end" aria-labelledby="end-title">
      <p className="eyebrow">The lamp burns low · the counsellor's report</p>
      <h2 id="end-title" className="title title-sm">
        Case closed
      </h2>
      <p className="lede">
        Four campers, four secrets, one lantern. A mushroom, a rabbit, a snail and a rocket: a
        perfectly normal night at Camp Pinecone, told entirely in your shadows.
      </p>
      <ol className="told-list">
        {CHAPTERS.map((c) => (
          <li key={c.id}>
            <b>{c.title}.</b> {c.told}
          </li>
        ))}
      </ol>
      <button ref={button} type="button" className="cta" onClick={onReplay}>
        Tell them again
      </button>
    </section>
  );
}

export function CoachTip({ onDismiss }: { onDismiss: () => void }) {
  return (
    <aside className="coach" aria-label="How to play">
      <p>
        <b>Drag a prop</b> to move its shadow. <b>Scroll, pinch</b> or use Bigger/Smaller to bring
        it toward the lamp. <b>Turn</b> and <b>Tilt</b> change its outline.
      </p>
      <p className="coach-keys">
        Keys: 1–4 pick · arrows move · + − size · Q E turn · Z X tilt · H hint · R reset
      </p>
      <button type="button" className="coach-ok" onClick={onDismiss}>
        Got it
      </button>
    </aside>
  );
}

export const LAST_CHAPTER = CHAPTERS.length - 1;
