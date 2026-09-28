import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, PointsMaterial } from "three";
import { LAMP } from "../game/shadow";
import { softDot } from "./textures";

// Dust motes drifting in the lantern beam: a few hundred additive points inside the cone
// between lamp and tent. Still (and fewer) under reduced motion.

export interface Dust {
  object: Points;
  tick(t: number): void;
}

export function createDust(reducedMotion: boolean): Dust {
  const count = reducedMotion ? 80 : 260;
  const base = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const k = Math.random();
    const z = LAMP[2] - 0.3 - k * (LAMP[2] - 0.4);
    const spread = 0.15 + (LAMP[2] - z) * 0.55;
    base[i * 3] = LAMP[0] + (Math.random() * 2 - 1) * spread;
    base[i * 3 + 1] = LAMP[1] + 0.1 + Math.random() * spread * 1.2;
    base[i * 3 + 2] = z;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const pos = new Float32Array(base);
  const geometry = new BufferGeometry();
  const material = new PointsMaterial({
    color: "#ffd9a8",
    map: softDot(),
    size: 0.022,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const points = new Points(geometry, material);
  const attr = new BufferAttribute(pos, 3);
  geometry.setAttribute("position", attr);
  points.frustumCulled = false;
  const tick = (t: number) => {
    if (reducedMotion) return;
    const s = t / 1000;
    for (let i = 0; i < count; i++) {
      const p = phase[i] ?? 0;
      pos[i * 3] = (base[i * 3] ?? 0) + 0.05 * Math.sin(s * 0.21 + p);
      pos[i * 3 + 1] = (base[i * 3 + 1] ?? 0) + 0.07 * Math.sin(s * 0.13 + p * 1.7);
      pos[i * 3 + 2] = (base[i * 3 + 2] ?? 0) + 0.04 * Math.cos(s * 0.17 + p);
    }
    attr.needsUpdate = true;
  };
  return { object: points, tick };
}
