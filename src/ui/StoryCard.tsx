import type { Chapter } from "../game/chapters";
import { CHAPTERS } from "../game/chapters";
import { likenessWord } from "../game/words";
import { Sketch } from "./Sketch";

// The story prompt, the camper's sketch, the likeness meter and (after a hint) the advice.

export function StoryCard({
  chapter,
  index,
  sketch,
  score,
  advice,
  inert = false,
}: {
  chapter: Chapter;
  index: number;
  sketch: Uint8Array;
  score: number;
  advice: string | null;
  inert?: boolean;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, score / chapter.pass)) * 100);
  const likeness = likenessWord(score, chapter.pass);
  return (
    <section
      aria-label="The story to tell"
      className="panel story"
      inert={inert}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: The bounded story region must support keyboard scrolling.
      tabIndex={0}
    >
      <p className="eyebrow">
        Story {index + 1} of {CHAPTERS.length} · {chapter.teller}
      </p>
      <div className="flex items-start gap-3">
        <Sketch grid={sketch} label={`Sketch of ${chapter.target}`} />
        <div className="min-w-0">
          <h2 className="story-title">{chapter.title}</h2>
          <p className="story-prompt">{chapter.prompt}</p>
        </div>
      </div>
      <div className="meter-row">
        <span id="likeness-label" className="meter-label">
          Likeness
        </span>
        <meter
          className="sr-only-text"
          aria-labelledby="likeness-label"
          min={0}
          max={100}
          value={pct}
          aria-valuetext={`${likeness}, ${pct} percent of the needed likeness`}
        />
        <div className="meter" aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </div>
        <span className="meter-word" aria-hidden="true">
          {likeness}
        </span>
      </div>
      <p className="advice" aria-live="polite">
        {advice ?? "Need a nudge? Press Hint (H) for advice."}
      </p>
    </section>
  );
}
