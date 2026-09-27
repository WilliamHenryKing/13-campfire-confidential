import { LAMP, magnification } from "./shadow";
import type { Placement, PropKind } from "./types";

export interface ChapterProp {
  kind: PropKind;
  start: Placement;
  /** One known good answer. Any arrangement that casts a similar figure also counts. */
  solution: Placement;
}

export interface Chapter {
  id: string;
  title: string;
  /** What the figure should be, in two or three words. */
  target: string;
  teller: string;
  prompt: string;
  told: string;
  /** Likeness that counts as told; figures with thin parts are judged a little more kindly. */
  pass: number;
  props: readonly ChapterProp[];
}

/** Author a placement by where its centre's shadow should land on the wall. */
export function hang(sx: number, sy: number, z: number, turn = 0, tilt = 0): Placement {
  const m = magnification(z);
  return { x: LAMP[0] + (sx - LAMP[0]) / m, y: LAMP[1] + (sy - LAMP[1]) / m, z, turn, tilt };
}

function at(x: number, y: number, z: number, turn = 0, tilt = 0): Placement {
  return { x, y, z, turn, tilt };
}

export const CHAPTERS: readonly Chapter[] = [
  {
    id: "mushroom",
    title: "The Mushroom",
    target: "a giant mushroom",
    teller: "Ada, Cabin 3",
    prompt:
      "“A mushroom the size of a tent came up by the lake. I swear. Its cap was wider than its stalk and it just stood there, looking at me.”",
    told: "Nobody has eaten it. Nobody is allowed to eat it.",
    pass: 0.8,
    props: [
      { kind: "thermos", start: at(-0.9, 1.0, 1.4), solution: hang(0, 1.25, 2.2) },
      { kind: "bowl", start: at(0.8, 1.1, 1.2), solution: hang(0, 1.8, 3.05) },
    ],
  },
  {
    id: "rabbit",
    title: "The Rabbit",
    target: "a long-eared rabbit",
    teller: "Theo, Cabin 1",
    prompt:
      "“Something with very long ears took the marshmallows. Round head, ears swept back. It whistled when it ran.”",
    told: "The whistling was the kettle. The marshmallows are still missing.",
    pass: 0.72,
    props: [
      { kind: "kettle", start: at(0.3, 0.9, 1.3), solution: hang(0.05, 1.35, 2.7) },
      { kind: "spoon", start: at(-1.0, 1.1, 1.6), solution: hang(-0.46, 1.88, 2.4, 0, 2) },
      { kind: "spoon", start: at(1.2, 1.2, 1.0), solution: hang(-0.04, 1.95, 2.4, 0, 1) },
    ],
  },
  {
    id: "snail",
    title: "The Snail",
    target: "an enormous snail",
    teller: "Mo, Cabin 2",
    prompt:
      "“It came up the path at a tremendous crawl. Head held high at the front, a big round shell on its back.”",
    told: "It left a shiny trail straight to the dishwashing tub. Suspicious.",
    pass: 0.8,
    props: [
      { kind: "boot", start: at(-0.8, 1.0, 1.3, 2), solution: hang(0, 1.2, 2.2) },
      { kind: "pan", start: at(0.9, 1.2, 1.1, 2), solution: hang(0.55, 1.32, 2.6, 0, -1) },
    ],
  },
  {
    id: "rocket",
    title: "The Rocket",
    target: "a rocket on its launch fins",
    teller: "The counsellor",
    prompt:
      "“Fine. Here is what I saw. Pointed nose, long body, two fins at the bottom. It left at midnight and took the good thermos.”",
    told: "Case closed. The thermos came back in the morning, still warm.",
    pass: 0.74,
    props: [
      { kind: "thermos", start: at(0.9, 0.9, 1.2), solution: hang(0, 1.5, 2.4) },
      { kind: "pinecone", start: at(-1.0, 1.0, 1.5), solution: hang(0, 2.15, 1.9) },
      { kind: "spoon", start: at(-0.35, 1.2, 1.0), solution: hang(-0.3, 0.98, 2.4, 0, 9) },
      { kind: "spoon", start: at(0.35, 1.3, 0.9), solution: hang(0.3, 0.98, 2.4, 0, -9) },
    ],
  },
];

export const LIMITS = {
  minX: -1.6,
  maxX: 1.6,
  maxY: 2.1,
  minZ: 0.7,
  maxZ: 3.3,
} as const;
