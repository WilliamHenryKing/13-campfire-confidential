import { gsap } from "gsap";
import { CylinderGeometry, Mesh, MeshStandardMaterial } from "three";
import type { Frame } from "../game/compare";
import { PROPS } from "../game/props";
import type { Placement, PropKind } from "../game/types";
import { attachInput, type InputHandlers } from "./input";
import { createWallOverlay } from "./overlay";
import { buildProp, disposeProp, highlightProp, type PropView, placeProp } from "./props";
import { createStage } from "./stage";

// The scene as the rest of the app sees it: show a chapter's props, keep them in sync with
// the game state, trace the sketch, and paint the final tableau.

const LINE_TOP = 5.2;

export interface World {
  showProps(kinds: readonly PropKind[]): void;
  sync(placements: readonly Placement[], selected: number, active: boolean): void;
  trace(grid: Uint8Array | null, frame: Frame | null): void;
  tableau(figures: readonly Uint8Array[], captions: readonly string[]): void;
  bind(handlers: Omit<InputHandlers, "pickable">): void;
  start(onFirstFrame: () => void): void;
}

export function createWorld(host: HTMLElement, reducedMotion: boolean): World {
  const stage = createStage(host, reducedMotion);
  const overlay = createWallOverlay();
  stage.scene.add(overlay.mesh);

  const stringMat = new MeshStandardMaterial({ color: "#e8dcc4", roughness: 0.9 });
  const stringGeo = new CylinderGeometry(0.0035, 0.0035, 1, 5);
  stringGeo.translate(0, 0.5, 0);

  let views: { view: PropView; string: Mesh; kind: PropKind }[] = [];
  let tableauTween: gsap.core.Tween | null = null;

  const world: World = {
    showProps(kinds) {
      for (const v of views) {
        disposeProp(v.view);
        stage.props.remove(v.view.group, v.string);
      }
      views = kinds.map((kind) => {
        const view = buildProp(kind);
        const string = new Mesh(stringGeo, stringMat);
        stage.props.add(view.group, string);
        return { view, string, kind };
      });
      stage.props.visible = true;
      tableauTween?.kill();
      overlay.clear();
      stage.invalidate();
    },
    sync(placements, selected, active) {
      views.forEach((v, i) => {
        const at = placements[i];
        if (!at) return;
        placeProp(v.view, at);
        const top = at.y + PROPS[v.kind].radius * 0.55;
        v.string.position.set(at.x, top, at.z);
        v.string.scale.set(1, Math.max(0.01, LINE_TOP - top), 1);
        highlightProp(v.view, active && i === selected);
      });
      stage.invalidate();
    },
    trace(grid, frame) {
      overlay.trace(grid, frame);
    },
    tableau(figures, captions) {
      stage.props.visible = false;
      stage.invalidate();
      tableauTween?.kill();
      if (reducedMotion) {
        overlay.tableau(figures, captions, 1);
        return;
      }
      const t = { reveal: 0 };
      tableauTween = gsap.to(t, {
        reveal: 1,
        duration: 3.2,
        ease: "power1.inOut",
        onUpdate: () => overlay.tableau(figures, captions, t.reveal),
      });
    },
    bind(handlers) {
      attachInput(stage.renderer.domElement, stage.camera, {
        ...handlers,
        pickable: () => (stage.props.visible ? views.map((v) => v.view.group) : []),
      });
    },
    start(onFirstFrame) {
      stage.start(() => {}, onFirstFrame);
    },
  };
  return world;
}
