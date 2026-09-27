import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

// Small procedural textures: woven canvas for the tent and a trampled grass floor.

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return [c, ctx];
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export function canvasWeave(): CanvasTexture {
  const [c, ctx] = canvas(256);
  const r = seeded(3);
  ctx.fillStyle = "#e9d8b4";
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    ctx.fillStyle = `rgba(120, 90, 50, ${0.05 + r() * 0.06})`;
    ctx.fillRect(0, y, 256, 1);
  }
  for (let x = 0; x < 256; x += 2) {
    ctx.fillStyle = `rgba(255, 245, 225, ${0.04 + r() * 0.06})`;
    ctx.fillRect(x, 0, 1, 256);
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(110, 80, 40, ${r() * 0.05})`;
    ctx.beginPath();
    ctx.arc(r() * 256, r() * 256, 6 + r() * 26, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new CanvasTexture(c);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function grass(): CanvasTexture {
  const [c, ctx] = canvas(256);
  const r = seeded(9);
  ctx.fillStyle = "#39402a";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const g = 50 + r() * 50;
    ctx.strokeStyle = `rgba(${g + 20}, ${g + 40}, ${g - 10}, 0.5)`;
    const x = r() * 256;
    const y = r() * 256;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 5);
    ctx.stroke();
  }
  const tex = new CanvasTexture(c);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  return tex;
}
