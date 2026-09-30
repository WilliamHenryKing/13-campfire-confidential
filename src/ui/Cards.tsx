import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { SoundEngine } from "../audio/engine";
import { CHAPTERS, type Chapter } from "../game/chapters";
import { trapDialogTab } from "./focus";
import { MuteButton } from "./MuteButton";

// The readable story dialogs leave the shadow scene visible behind them.

function useDialogFocus() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    if (ref.current) ref.current.scrollTop = 0;
  }, []);
  return ref;
}

function subscribeMotion(notify: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}

function useReducedMotion() {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** Split a told line into sentences, revealed one after another. */
export function sentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
}

export function ToldCard({
  chapter,
  last,
  onNext,
  sound,
}: {
  chapter: Chapter;
  last: boolean;
  onNext: () => void;
  sound: SoundEngine;
}) {
  const dialog = useDialogFocus();
  const button = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  const lines = sentences(chapter.told);
  const [reveal, setReveal] = useState({ id: chapter.id, count: reduced ? lines.length : 0 });
  const shown = reduced ? lines.length : reveal.id === chapter.id ? reveal.count : 0;
  useEffect(() => {
    if (reduced) {
      setReveal({ id: chapter.id, count: lines.length });
      return;
    }
    if (shown >= lines.length) return;
    const t = window.setTimeout(
      () => setReveal({ id: chapter.id, count: shown + 1 }),
      shown === 0 ? 900 : 1300,
    );
    return () => window.clearTimeout(t);
  }, [shown, lines.length, chapter.id, reduced]);
  return (
    <section
      ref={dialog}
      className="card card-told"
      role="dialog"
      aria-modal="true"
      aria-labelledby="told-title"
      aria-describedby="told-copy"
      tabIndex={-1}
      onKeyDown={(e) =>
        trapDialogTab(e, [
          ...(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []),
        ])
      }
    >
      <p className="eyebrow">Secret told · {chapter.teller}</p>
      <h2 id="told-title" className="story-title">
        {chapter.title}
      </h2>
      <p id="told-copy" className="sr-only-text">
        {chapter.told}
      </p>
      <p className="lede told-lines" aria-hidden="true">
        {lines.map((line, i) => (
          <span key={line} className={i < shown ? "line is-shown" : "line"}>
            {line}{" "}
          </span>
        ))}
      </p>
      <div className="dialog-actions">
        <MuteButton sound={sound} inline />
        <button ref={button} type="button" className="cta" onClick={onNext}>
          {last ? "Close the case" : "Next story"}
        </button>
      </div>
    </section>
  );
}

export function EndingCard({ onReplay, sound }: { onReplay: () => void; sound: SoundEngine }) {
  const dialog = useDialogFocus();
  const button = useRef<HTMLButtonElement>(null);
  return (
    <section
      ref={dialog}
      className="card card-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-title"
      aria-describedby="end-copy"
      tabIndex={-1}
      onKeyDown={(e) =>
        trapDialogTab(e, [
          ...(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []),
        ])
      }
    >
      <p className="eyebrow">The lamp burns low · the counsellor's report</p>
      <h2 id="end-title" className="title title-sm">
        Case closed
      </h2>
      <p id="end-copy" className="lede">
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
      <div className="dialog-actions">
        <MuteButton sound={sound} inline />
        <button ref={button} type="button" className="cta" onClick={onReplay}>
          Tell them again
        </button>
      </div>
    </section>
  );
}

export const LAST_CHAPTER = CHAPTERS.length - 1;
