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
}: {
  chapter: Chapter;
  index: number;
  sketch: Uint8Array;
  score: number;
  advice: string | null;
}) {
  const pct = Math.round(Math.min(1, score / chapter.pass) * 100);
  return (
    <section aria-label="The story to tell" className="panel story">
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
        <span className="meter-label">Likeness</span>
        <div className="meter" aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </div>
        <span className="meter-word">
          {likenessWord(score, chapter.pass)}
          <span className="sr-only-text"> ({pct}%)</span>
        </span>
      </div>
      <p className="advice" aria-live="polite">
        {advice ?? "Need a nudge? Press Hint (H) for advice."}
      </p>
    </section>
  );
}
