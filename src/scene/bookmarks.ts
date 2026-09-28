// Named camera views for visual captures. Each holds position, look-at target and vertical
// field of view; the game camera is untouched unless a bookmark is set.

export interface Bookmark {
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
  /** Viewport the bookmark is composed for. */
  viewport: { width: number; height: number };
}

export const BOOKMARKS: Record<string, Bookmark> = {
  /** Establishing wide: outside and behind the tent, the shadow play glowing through. */
  establishing: {
    pos: [-6.2, 2.6, -6.8],
    target: [0.2, 1.6, 0.4],
    fov: 42,
    viewport: { width: 1440, height: 900 },
  },
  /** Hero: the play camera, the figure on the canvas. */
  hero: {
    pos: [1.1, 2.45, 8.4],
    target: [0, 1.5, 1.0],
    fov: 40,
    viewport: { width: 1440, height: 900 },
  },
  /** Arm's length: the hanging props and the lantern up close. */
  closeup: {
    pos: [0.9, 1.25, 4.1],
    target: [0.05, 0.95, 2.2],
    fov: 38,
    viewport: { width: 1440, height: 900 },
  },
  /** Grazing angle along the canvas: weave, seams and the shadow edge. */
  grazing: {
    pos: [3.1, 1.35, 0.55],
    target: [-0.4, 1.55, 0.02],
    fov: 45,
    viewport: { width: 1440, height: 900 },
  },
  /** Phone portrait of the hero. */
  "phone-hero": {
    pos: [0.35, 2.8, 9.6],
    target: [0, 1.3, 1.0],
    fov: 58,
    viewport: { width: 390, height: 844 },
  },
};
