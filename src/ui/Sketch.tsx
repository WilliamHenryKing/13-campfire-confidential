import { useEffect, useRef } from "react";
import { NORM } from "../game/compare";

// The camper's sketch of the figure: the target shadow drawn in ink on a scrap of card.

export function Sketch({ grid, label }: { grid: Uint8Array; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let minI = NORM;
    let maxI = 0;
    let minJ = NORM;
    let maxJ = 0;
    for (let j = 0; j < NORM; j++)
      for (let i = 0; i < NORM; i++)
        if (grid[j * NORM + i]) {
          minI = Math.min(minI, i);
          maxI = Math.max(maxI, i);
          minJ = Math.min(minJ, j);
          maxJ = Math.max(maxJ, j);
        }
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    if (maxI < minI) return;
    const span = Math.max(maxI - minI, maxJ - minJ) + 1;
    const cell = (size * 0.84) / span;
    const ox = (size - (maxI - minI + 1) * cell) / 2;
    const oy = (size - (maxJ - minJ + 1) * cell) / 2;
    ctx.fillStyle = "#2a1a10";
    ctx.filter = "blur(0.6px)";
    for (let j = minJ; j <= maxJ; j++)
      for (let i = minI; i <= maxI; i++)
        if (grid[j * NORM + i])
          ctx.fillRect(ox + (i - minI) * cell, oy + (maxJ - j) * cell, cell + 0.7, cell + 0.7);
  }, [grid]);

  return (
    <canvas
      ref={ref}
      width={160}
      height={160}
      role="img"
      aria-label={label}
      className="sketch h-20 w-20 shrink-0 rounded-md md:h-24 md:w-24"
    />
  );
}
