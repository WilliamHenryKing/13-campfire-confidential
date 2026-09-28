import { CHAPTERS } from "./game/chapters";
import { initialState } from "./game/state";
import { BOOKMARKS } from "./scene/bookmarks";
import type { World } from "./scene/world";
import type { Store } from "./ui/store";

// Capture hook for visual evidence (docs/visual). Installed only in dev builds or with ?e2e,
// never in a normal production visit.

export interface VisualTest {
  /** Resolves once the first frame is drawn and textures have loaded. */
  ready: Promise<void>;
  bookmarks: string[];
  setBookmark(name: string | null): void;
  freeze(): void;
  /** Wait for shadows and post-processing to settle (default 8 frames). */
  settle(frames?: number): Promise<void>;
  /** Pose story `index` with its props at the start or at a known answer (play phase). */
  story(index: number, solved: boolean): void;
  /** Hide or show the HUD for scene-only captures. */
  hud(visible: boolean): void;
  renderer(): string;
}

export function wantsVisualTest(): boolean {
  return import.meta.env.DEV || new URLSearchParams(window.location.search).has("e2e");
}

export function installVisualTest(
  world: World,
  store: Store,
  ready: Promise<void>,
  setCapture: (on: boolean) => void,
) {
  const hook: VisualTest = {
    ready,
    bookmarks: Object.keys(BOOKMARKS),
    setBookmark(name) {
      world.setView(name ? (BOOKMARKS[name] ?? null) : null);
    },
    freeze() {
      world.setFrozen(true);
    },
    settle(frames = 8) {
      return world.frames(frames);
    },
    story(index, solved) {
      const chapter = CHAPTERS[index];
      if (!chapter) return;
      setCapture(true);
      store.replace({
        ...initialState(),
        phase: "play",
        chapter: index,
        placements: chapter.props.map((p) => ({ ...(solved ? p.solution : p.start) })),
      });
    },
    hud(visible) {
      document.documentElement.classList.toggle("capture-clean", !visible);
    },
    renderer: () => world.rendererName(),
  };
  (window as unknown as { __VISUAL_TEST__: VisualTest }).__VISUAL_TEST__ = hook;
}
