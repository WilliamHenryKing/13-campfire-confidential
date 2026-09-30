import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SoundEngine } from "../src/audio/engine";
import { CHAPTERS } from "../src/game/chapters";
import { EndingCard, sentences, ToldCard } from "../src/ui/Cards";
import { Controls } from "../src/ui/Controls";
import { focusProp, trapDialogTab } from "../src/ui/focus";
import { StoryCard } from "../src/ui/StoryCard";

const chapter = CHAPTERS[0];
if (!chapter) throw new Error("The first story must exist");
const sound: SoundEngine = {
  muted: false,
  setMuted: () => {},
  subscribe: () => () => {},
  begin: () => {},
  play: () => {},
  setMood: () => {},
  owl: () => {},
  dispose: () => {},
};

describe("story controls and focus", () => {
  test("selection focus reaches the requested prop and reveals it in the bounded controls", () => {
    const calls: unknown[] = [];
    const button = {
      disabled: false,
      closest: () => null,
      focus: (options: unknown) => calls.push(options),
      scrollIntoView: (options: unknown) => calls.push(options),
    };
    const root = {
      querySelector(selector: string) {
        calls.push(selector);
        return button;
      },
    } as unknown as ParentNode;
    expect(focusProp(2, root)).toBe(true);
    expect(calls).toEqual([
      'button[data-prop="2"]',
      { preventScroll: true },
      { block: "nearest", inline: "nearest" },
    ]);
    button.disabled = true;
    expect(focusProp(2, root)).toBe(false);
    expect(calls).toHaveLength(4);
  });

  test("an inert prop or absent selector never receives focus", () => {
    const root = {
      querySelector: () => ({ disabled: false, closest: () => ({}) }),
    } as unknown as ParentNode;
    expect(focusProp(0, root)).toBe(false);
    root.querySelector = (() => null) as ParentNode["querySelector"];
    expect(focusProp(4, root)).toBe(false);
  });

  test("dialog Tab stays on its action without consuming scroll or activation keys", () => {
    let focused = 0;
    let prevented = 0;
    const action = { focus: () => focused++ } as unknown as HTMLElement;
    const event = (key: string) => ({ key, preventDefault: () => prevented++ });
    for (const key of ["Enter", " ", "ArrowDown", "PageDown", "Escape"]) {
      trapDialogTab(event(key), [action]);
    }
    expect(focused).toBe(0);
    trapDialogTab(event("Tab"), [action]);
    trapDialogTab(event("Tab"), [action]);
    expect(focused).toBe(2);
    expect(prevented).toBe(2);
    trapDialogTab(event("Tab"), []);
    expect(prevented).toBe(2);
  });

  test("dialog sound and story actions cycle in both directions, including initial backward Tab", () => {
    const focused: string[] = [];
    const mute = { focus: () => focused.push("sound") } as unknown as HTMLElement;
    const next = { focus: () => focused.push("story") } as unknown as HTMLElement;
    const event = (target?: HTMLElement, shiftKey = false) => ({
      key: "Tab",
      target,
      shiftKey,
      preventDefault: () => {},
    });
    trapDialogTab(event(), [mute, next]);
    trapDialogTab(event(mute), [mute, next]);
    trapDialogTab(event(next), [mute, next]);
    trapDialogTab(event(next, true), [mute, next]);
    trapDialogTab(event(mute, true), [mute, next]);
    trapDialogTab(event(undefined, true), [mute, next]);
    expect(focused).toEqual(["sound", "story", "sound", "sound", "story", "story"]);
  });

  test("curtain-disabled controls include the guide and retain exact prop and shortcut semantics", () => {
    const html = renderToStaticMarkup(
      createElement(Controls, {
        names: ["Thermos", "Enamel bowl"],
        selected: 1,
        hintLevel: 0,
        disabled: true,
        dispatch: () => {},
        guide: createElement("button", { type: "button" }, "Skip the guide"),
      }),
    );
    expect(html).toContain('class="panel controls" inert=""');
    expect(html.indexOf("Skip the guide")).toBeLessThan(html.indexOf("<fieldset"));
    expect(html).toContain('aria-pressed="true" aria-keyshortcuts="2" data-prop="1"');
    expect(html).toContain("Selected prop: Enamel bowl");
    expect(html).toContain('aria-keyshortcuts="ArrowUp"');
    expect(html.match(/disabled=""/g)?.length).toBe(11);
  });

  test("likeness is a named, bounded native meter with meaningful threshold text", () => {
    const render = (score: number) =>
      renderToStaticMarkup(
        createElement(StoryCard, {
          chapter,
          index: 0,
          sketch: new Uint8Array(1),
          score,
          advice: null,
        }),
      );
    expect(render(-0.2)).toContain('min="0" max="100" value="0"');
    const solved = render(1);
    expect(solved).toContain('min="0" max="100" value="100"');
    expect(solved).toContain('aria-labelledby="likeness-label"');
    expect(solved).toContain("100 percent of the needed likeness");
    expect(solved).toContain('aria-label="The story to tell" class="panel story" tabindex="0"');
  });

  test("revealed and final stories are named dialogs, with full readable text independent of fades", () => {
    const told = renderToStaticMarkup(
      createElement(ToldCard, { chapter, last: false, onNext: () => {}, sound }),
    );
    expect(told).toContain('role="dialog" aria-modal="true" aria-labelledby="told-title"');
    expect(told).toContain('aria-describedby="told-copy" tabindex="-1"');
    expect(told).toContain(`<p id="told-copy" class="sr-only-text">${chapter.told}</p>`);
    expect(told).toContain('class="lede told-lines" aria-hidden="true"');
    const ending = renderToStaticMarkup(createElement(EndingCard, { onReplay: () => {}, sound }));
    expect(ending).toContain('role="dialog" aria-modal="true" aria-labelledby="end-title"');
    expect(ending).toContain('aria-describedby="end-copy" tabindex="-1"');
    expect(ending.match(/<li>/g)).toHaveLength(4);
    expect(ending).toContain('class="dialog-sound"');
    expect(told).toContain('class="dialog-sound"');
    expect(ending.indexOf("Sound on")).toBeLessThan(ending.indexOf("Tell them again"));
  });

  test("sentence reveals preserve authored punctuation and skip empty padding", () => {
    expect(sentences("  Case closed. Still warm! Really?  ")).toEqual([
      "Case closed.",
      "Still warm!",
      "Really?",
    ]);
    expect(sentences("   ")).toEqual([]);
  });
});
