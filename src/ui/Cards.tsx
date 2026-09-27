import { useEffect, useRef } from "react";
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
  return (
    <section className="card card-told" aria-live="polite" aria-labelledby="told-title">
      <p className="eyebrow">Told</p>
      <h2 id="told-title" className="story-title">
        {chapter.title}
      </h2>
      <p className="lede">{chapter.told}</p>
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
      <p className="eyebrow">The counsellor's report</p>
      <h2 id="end-title" className="title title-sm">
        Case closed
      </h2>
      <p className="lede">
        A mushroom, a rabbit, a snail and a rocket. A perfectly normal night at Camp Pinecone, told
        entirely in your shadows.
      </p>
      <ol className="told-list">
        {CHAPTERS.map((c) => (
          <li key={c.id}>
            <b>{c.title}.</b> {c.told}
          </li>
        ))}
      </ol>
      <button ref={button} type="button" className="cta" onClick={onReplay}>
        Tell it again
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
