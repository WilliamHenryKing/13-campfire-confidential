import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from "three";
import { type Frame, NORM, NORM_EXTENT } from "../game/compare";
import { WALL } from "../game/shadow";

// A transparent canvas stretched over the tent wall: the camper's sketch traced in chalk
// (hint level 2), the gold outline when a story is told, and the final tableau painted from
// the player's own shadows with the campers leaning into the lamplight.

const PX = 100; // canvas pixels per metre of wall
const W = Math.round((WALL.maxX - WALL.minX) * PX);
const H = Math.round((WALL.maxY - WALL.minY) * PX);

export interface WallOverlay {
  mesh: Mesh;
  trace(grid: Uint8Array | null, frame: Frame | null): void;
  reveal(grid: Uint8Array, frame: Frame, alpha: number): void;
  tableau(figures: readonly Uint8Array[], captions: readonly string[], reveal: number): void;
  clear(): void;
}

function toCanvas(x: number, y: number): [number, number] {
  return [(x - WALL.minX) * PX, H - (y - WALL.minY) * PX];
}

/** Draw a normalised figure's outline (edges between filled and empty cells). */
function outline(
  ctx: CanvasRenderingContext2D,
  grid: Uint8Array,
  place: (u: number, v: number) => [number, number],
) {
  const step = (2 * NORM_EXTENT) / NORM;
  const filled = (i: number, j: number) =>
    i >= 0 && j >= 0 && i < NORM && j < NORM && grid[j * NORM + i] === 1;
  ctx.beginPath();
  for (let j = 0; j < NORM; j++)
    for (let i = 0; i < NORM; i++) {
      if (!filled(i, j)) continue;
      const u0 = -NORM_EXTENT + i * step;
      const v0 = -NORM_EXTENT + j * step;
      const edges: [number, number, number, number][] = [];
      if (!filled(i - 1, j)) edges.push([u0, v0, u0, v0 + step]);
      if (!filled(i + 1, j)) edges.push([u0 + step, v0, u0 + step, v0 + step]);
      if (!filled(i, j - 1)) edges.push([u0, v0, u0 + step, v0]);
      if (!filled(i, j + 1)) edges.push([u0, v0 + step, u0 + step, v0 + step]);
      for (const [a, b, c, d] of edges) {
        ctx.moveTo(...place(a, b));
        ctx.lineTo(...place(c, d));
      }
    }
  ctx.stroke();
}

function fill(
  ctx: CanvasRenderingContext2D,
  grid: Uint8Array,
  place: (u: number, v: number) => [number, number],
) {
  const step = (2 * NORM_EXTENT) / NORM;
  for (let j = 0; j < NORM; j++)
    for (let i = 0; i < NORM; i++) {
      if (grid[j * NORM + i] !== 1) continue;
      const [x0, y0] = place(-NORM_EXTENT + i * step, -NORM_EXTENT + (j + 1) * step);
      const [x1, y1] = place(-NORM_EXTENT + (i + 1) * step, -NORM_EXTENT + j * step);
      ctx.fillRect(Math.min(x0, x1), y0, Math.abs(x1 - x0) + 0.6, y1 - y0 + 0.6);
    }
}

/** Seated campers' silhouettes at both edges of the wall, soft as real shadows. */
function campers(ctx: CanvasRenderingContext2D, alpha: number) {
  if (alpha <= 0) return;
  const people: [number, number, number][] = [
    [-3.0, 0.95, 1],
    [-2.35, 0.8, -1],
    [2.4, 0.9, 1],
    [3.05, 1.0, -1],
  ];
  ctx.save();
  ctx.filter = "blur(5px)";
  ctx.fillStyle = `rgba(30, 18, 12, ${0.8 * alpha})`;
  for (const [x, h, lean] of people) {
    const [bx, by] = toCanvas(x, 0);
    const [, headY] = toCanvas(x, h);
    const r = 0.13 * PX;
    ctx.beginPath();
    ctx.ellipse(bx, by, 0.34 * PX, (h - 0.2) * PX, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + lean * 0.06 * PX, headY, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function createWallOverlay(): WallOverlay {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const mesh = new Mesh(
    new PlaneGeometry(WALL.maxX - WALL.minX, WALL.maxY - WALL.minY),
    new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  mesh.position.set((WALL.minX + WALL.maxX) / 2, (WALL.minY + WALL.maxY) / 2, 0.012);
  mesh.renderOrder = 2;

  const clear = () => {
    ctx.clearRect(0, 0, W, H);
    texture.needsUpdate = true;
  };

  return {
    mesh,
    clear,
    trace(grid, frame) {
      ctx.clearRect(0, 0, W, H);
      if (grid && frame && frame.scale > 0) {
        const place = (u: number, v: number) =>
          toCanvas(frame.cx + (frame.mirror ? -u : u) * frame.scale, frame.cy + v * frame.scale);
        ctx.fillStyle = "rgba(255, 214, 150, 0.16)";
        fill(ctx, grid, place);
        ctx.strokeStyle = "rgba(255, 236, 200, 0.85)";
        ctx.lineWidth = 3;
        ctx.setLineDash([9, 7]);
        outline(ctx, grid, place);
        ctx.setLineDash([]);
      }
      texture.needsUpdate = true;
    },
    reveal(grid, frame, alpha) {
      ctx.clearRect(0, 0, W, H);
      if (frame.scale > 0) {
        const place = (u: number, v: number) =>
          toCanvas(frame.cx + (frame.mirror ? -u : u) * frame.scale, frame.cy + v * frame.scale);
        ctx.filter = "blur(6px)";
        ctx.strokeStyle = `rgba(255, 190, 90, ${0.55 * alpha})`;
        ctx.lineWidth = 10;
        outline(ctx, grid, place);
        // A light blur rounds off the grid's stair steps on the crisp line too.
        ctx.filter = "blur(1.6px)";
        ctx.lineJoin = "round";
        ctx.strokeStyle = `rgba(255, 226, 160, ${0.95 * alpha})`;
        ctx.lineWidth = 4;
        outline(ctx, grid, place);
        ctx.filter = "none";
      }
      texture.needsUpdate = true;
    },
    tableau(figures, captions, reveal) {
      ctx.clearRect(0, 0, W, H);
      campers(ctx, Math.min(1, reveal * 2));
      const n = figures.length;
      // A 2 × 2 storyboard in the middle of the wall, so it reads on a phone as well.
      const s = 0.45;
      figures.forEach((grid, k) => {
        const alpha = Math.max(0, Math.min(1, reveal * n - k));
        if (alpha <= 0) return;
        const cx = k % 2 === 0 ? -1.0 : 1.0;
        const cy = k < 2 ? 2.65 : 1.2;
        const place = (u: number, v: number) => toCanvas(cx + u * s, cy + v * s);
        ctx.filter = "blur(2.5px)";
        ctx.fillStyle = `rgba(38, 22, 14, ${0.88 * alpha})`;
        fill(ctx, grid, place);
        ctx.filter = "none";
        ctx.fillStyle = `rgba(70, 40, 22, ${alpha})`;
        ctx.font = "italic 600 24px Georgia, 'Times New Roman', serif";
        ctx.textAlign = "center";
        const [tx, ty] = toCanvas(cx, cy - 0.7);
        ctx.fillText(captions[k] ?? "", tx, ty);
      });
      texture.needsUpdate = true;
    },
  };
}
