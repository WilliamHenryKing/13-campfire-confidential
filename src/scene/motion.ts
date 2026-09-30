// Small visual motions layered over the judged placements: pendulum swing when a prop is
// moved, and each story's "comes alive" moment after it is told. Visual only; the rules
// always judge the resting placement.

export interface Swing {
  angle: number;
  vel: number;
}

const OMEGA = 5.2; // rad/s, a short string
const DAMP = 2.4;
const MAX = 0.12;

export function kick(s: Swing, dx: number) {
  s.vel = Math.max(-2, Math.min(2, s.vel - dx * 9));
}

/** Advance a damped pendulum; returns true while it is still visibly moving. */
export function stepSwing(s: Swing, dt: number): boolean {
  const acc = -OMEGA * OMEGA * s.angle - DAMP * s.vel;
  s.vel += acc * dt;
  s.angle = Math.max(-MAX, Math.min(MAX, s.angle + s.vel * dt));
  if (Math.abs(s.angle) < 0.0015 && Math.abs(s.vel) < 0.01) {
    s.angle = 0;
    s.vel = 0;
    return false;
  }
  return true;
}

export interface Pose {
  dx: number;
  dy: number;
  roll: number;
}

export const ALIVE_SECONDS = 3.2;

/** How the whole figure moves t seconds after its story is told. */
export function alive(chapterId: string, t: number): Pose {
  t = Math.max(0, Math.min(ALIVE_SECONDS, t));
  const k = Math.min(1, t / ALIVE_SECONDS);
  const fade = Math.sin(Math.PI * k);
  switch (chapterId) {
    case "mushroom":
      return { dx: 0.05 * Math.sin(t * 3.2) * fade, dy: 0, roll: 0.05 * Math.sin(t * 3.2) * fade };
    case "rabbit":
      return { dx: 0, dy: 0.08 * Math.abs(Math.sin(t * 5)) * fade, roll: 0 };
    case "snail":
      return { dx: 0.12 * k, dy: 0.01 * Math.sin(t * 6) * fade, roll: 0 };
    case "rocket":
      return { dx: 0.01 * Math.sin(t * 40) * (1 - k), dy: 0.9 * k * k, roll: 0 };
    default:
      return { dx: 0, dy: 0, roll: 0 };
  }
}
