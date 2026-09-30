import { gsap } from "gsap";
import { CylinderGeometry, Mesh, MeshStandardMaterial } from "three";
import type { Frame } from "../game/compare";
import { PROPS } from "../game/props";
import type { Placement, PropKind } from "../game/types";
import type { Bookmark } from "./bookmarks";
import { attachInput, type InputBinding, type InputHandlers } from "./input";
import { ALIVE_SECONDS, alive, kick, type Swing, stepSwing } from "./motion";
import type { Opening } from "./opening";
import { createWallOverlay } from "./overlay";
import { buildProp, disposeProp, highlightProp, type PropView, placeProp } from "./props";
import { createStage } from "./stage";

// The scene as the rest of the app sees it: show a chapter's props, keep them in sync with
// the game state, trace the sketch, reveal a told story, and paint the final tableau.

const LINE_TOP = 5.2;

export interface World {
  readonly opening: Opening;
  setInteractive(interactive: boolean): void;
  setReducedMotion(reduced: boolean): void;
  dispose(): void;
  showProps(kinds: readonly PropKind[]): void;
  sync(placements: readonly Placement[], selected: number, active: boolean): void;
  trace(grid: Uint8Array | null, frame: Frame | null): void;
  /** A story was told: gold outline on the figure, warm wall, the figure comes alive. */
  reveal(chapterId: string, grid: Uint8Array, frame: Frame): void;
  tableau(figures: readonly Uint8Array[], captions: readonly string[]): void;
  bind(handlers: Omit<InputHandlers, "pickable">): void;
  start(onFirstFrame: () => void): void;
  /** Capture support: camera bookmark, frozen time, frame waits, GPU description. */
  setView(view: Bookmark | null): void;
  setFrozen(frozen: boolean): void;
  frames(n: number): Promise<void>;
  rendererName(): string;
  /** Resolves when the environment and all textures have loaded. */
  loaded: Promise<void>;
}

interface ViewState {
  view: PropView;
  string: Mesh;
  kind: PropKind;
  at: Placement | null;
  swing: Swing;
}

export function createWorld(host: HTMLElement, reducedMotion: boolean): World {
  const stage = createStage(host, reducedMotion);
  let disposed = false;
  let interactive = stage.opening.phase === "done";
  let input: InputBinding | null = null;
  const overlay = createWallOverlay();
  stage.scene.add(overlay.mesh);

  const stringMat = new MeshStandardMaterial({ color: "#6f5f4a", roughness: 1 });
  const stringGeo = new CylinderGeometry(0.0035, 0.0035, 1, 5);
  stringGeo.translate(0, 0.5, 0);

  let views: ViewState[] = [];
  let tween: gsap.core.Tween | null = null;
  const glow = { level: 1 };
  let aliveStory: { id: string; start: number; finished: boolean } | null = null;

  const glowTo = (level: number, duration: number, then?: () => void) => {
    if (disposed) return;
    gsap.killTweensOf(glow);
    if (reducedMotion) {
      glow.level = level;
      stage.setGlow(level);
      then?.();
      return;
    }
    gsap.to(glow, {
      level,
      duration,
      ease: "sine.inOut",
      onUpdate: () => stage.setGlow(glow.level),
      onComplete: then,
    });
  };

  /** Apply placement plus swing and story pose to one prop and its string. */
  const pose = (v: ViewState, now: number) => {
    if (!v.at) return;
    const story = aliveStory
      ? alive(aliveStory.id, Math.min(ALIVE_SECONDS, now - aliveStory.start))
      : null;
    const dx = (story?.dx ?? 0) + v.swing.angle * 0.12;
    const dy = story?.dy ?? 0;
    placeProp(v.view, { ...v.at, x: v.at.x + dx, y: v.at.y + dy });
    v.view.group.rotation.z += v.swing.angle + (story?.roll ?? 0);
    const top = v.at.y + dy + PROPS[v.kind].radius * 0.55;
    v.string.position.set(v.at.x + dx, top, v.at.z);
    v.string.scale.set(1, Math.max(0.01, LINE_TOP - top), 1);
    v.string.rotation.z = v.swing.angle * 0.5;
  };

  let lastT = -1;
  const onFrame = (t: number) => {
    if (t === lastT) return; // time is frozen for a capture
    const dt = lastT < 0 ? 0 : Math.min(0.05, Math.max(0, (t - lastT) / 1000));
    lastT = t;
    const now = t / 1000;
    let moving = false;
    for (const v of views) {
      const wasMoving = v.swing.angle !== 0 || v.swing.vel !== 0;
      if (stepSwing(v.swing, dt) || wasMoving) moving = true;
    }
    if (aliveStory && !aliveStory.finished) {
      moving = true;
      if (now - aliveStory.start >= ALIVE_SECONDS) aliveStory.finished = true;
    }
    if (!moving) return;
    for (const v of views) pose(v, now);
    stage.invalidate();
  };

  const world: World = {
    opening: stage.opening,
    setInteractive(on) {
      if (disposed) return;
      interactive = on;
      input?.setInteractive(on);
    },
    setReducedMotion(reduced) {
      if (disposed) return;
      reducedMotion = reduced;
      stage.setReducedMotion(reduced);
      if (reduced) {
        tween?.totalProgress(1);
        tween = null;
        for (const glowTween of gsap.getTweensOf(glow)) glowTween.totalProgress(1);
        aliveStory = null;
        for (const v of views) {
          v.swing.angle = v.swing.vel = 0;
          pose(v, performance.now() / 1000);
        }
        stage.invalidate();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      input?.dispose();
      input = null;
      tween?.kill();
      tween = null;
      gsap.killTweensOf(glow);
      aliveStory = null;
      for (const v of views) {
        disposeProp(v.view);
        stage.props.remove(v.view.group, v.string);
      }
      views = [];
      stringGeo.dispose();
      stringMat.dispose();
      stage.dispose();
    },
    showProps(kinds) {
      if (disposed) return;
      for (const v of views) {
        disposeProp(v.view);
        stage.props.remove(v.view.group, v.string);
      }
      views = kinds.map((kind) => {
        const view = buildProp(kind);
        const string = new Mesh(stringGeo, stringMat);
        stage.props.add(view.group, string);
        return { view, string, kind, at: null, swing: { angle: 0, vel: 0 } };
      });
      aliveStory = null;
      stage.props.visible = true;
      tween?.kill();
      tween = null;
      overlay.clear();
      glowTo(1, 0.8);
      stage.invalidate();
    },
    sync(placements, selected, active) {
      if (disposed) return;
      const now = performance.now() / 1000;
      views.forEach((v, i) => {
        const at = placements[i];
        if (!at) return;
        if (v.at && !reducedMotion && active) {
          const dx = at.x - v.at.x;
          if (Math.abs(dx) > 1e-4 && Math.abs(dx) < 0.5) kick(v.swing, dx);
        }
        v.at = at;
        pose(v, now);
        highlightProp(v.view, active && i === selected);
      });
      stage.invalidate();
    },
    trace(grid, frame) {
      if (disposed) return;
      overlay.trace(grid, frame);
    },
    reveal(chapterId, grid, frame) {
      if (disposed) return;
      for (const v of views) highlightProp(v.view, false);
      tween?.kill();
      if (reducedMotion) {
        overlay.reveal(grid, frame, 1);
        stage.setGlow(1.2);
        return;
      }
      const t = { a: 0 };
      tween = gsap.to(t, {
        a: 1,
        duration: 0.6,
        ease: "power2.out",
        onUpdate: () => overlay.reveal(grid, frame, t.a),
      });
      glowTo(1.45, 0.35, () => glowTo(1.15, 1.4));
      aliveStory = { id: chapterId, start: performance.now() / 1000 + 0.5, finished: false };
    },
    tableau(figures, captions) {
      if (disposed) return;
      stage.props.visible = false;
      aliveStory = null;
      stage.invalidate();
      tween?.kill();
      // The closing scene: the lamp dims to an ember while the storyboard is painted.
      glowTo(0.62, 2.5);
      if (reducedMotion) {
        overlay.tableau(figures, captions, 1);
        return;
      }
      const t = { reveal: 0 };
      tween = gsap.to(t, {
        reveal: 1,
        duration: 3.2,
        ease: "power1.inOut",
        onUpdate: () => overlay.tableau(figures, captions, t.reveal),
      });
    },
    bind(handlers) {
      if (disposed) return;
      input?.dispose();
      input = attachInput(stage.dom, stage.camera, {
        ...handlers,
        pickable: () => (stage.props.visible ? views.map((v) => v.view.group) : []),
      });
      input.setInteractive(interactive);
    },
    start(onFirstFrame) {
      stage.start(onFrame, onFirstFrame);
    },
    setView: (view) => stage.setView(view),
    setFrozen: (frozen) => stage.setFrozen(frozen),
    frames: (n) => stage.frames(n),
    rendererName: () => stage.rendererName(),
    loaded: stage.loaded,
  };
  return world;
}
