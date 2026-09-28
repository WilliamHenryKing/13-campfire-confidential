import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
} from "three";

// Sourced CC0 PBR sets (public/textures/<set>/, see assets.manifest.json): colour in sRGB,
// normal and ARM (AO · roughness · metalness) linear. Every load is tracked so captures can
// wait for a fully textured frame.

export type PbrSet = { colour: Texture; normal: Texture; arm: Texture };

const loader = new TextureLoader();
const cache = new Map<string, Texture>();
const pending: Promise<unknown>[] = [];
/** Clones waiting for their original's image: they upload only once flagged themselves. */
const followers = new Map<Texture, Texture[]>();
const base = `${import.meta.env.BASE_URL}textures/`;

function load(url: string, colour: boolean): Texture {
  const key = `${url}|${colour}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let done: (v: unknown) => void = () => {};
  pending.push(new Promise((r) => (done = r)));
  const texture = loader.load(
    url,
    (t) => {
      for (const c of followers.get(t) ?? []) c.needsUpdate = true;
      followers.delete(t);
      done(null);
    },
    undefined,
    done,
  );
  texture.colorSpace = colour ? SRGBColorSpace : NoColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.anisotropy = 8;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.name = url.split("/").slice(-1)[0] ?? url;
  cache.set(key, texture);
  return texture;
}

/** A set's three maps; clones share the image but carry their own repeat and offset. */
export function pbrSet(name: string): PbrSet {
  const stem = `${base}${name}/${name}`;
  return {
    colour: load(`${stem}_diff.webp`, true),
    normal: load(`${stem}_nor.webp`, false),
    arm: load(`${stem}_arm.webp`, false),
  };
}

export function paintMask(): Texture {
  return load(`${base}rusty_painted_metal/rusty_painted_metal_paint.webp`, false);
}

/** Same images, own tiling: for surfaces that need a different real-world scale. */
export function tiled(set: PbrSet, repeatU: number, repeatV = repeatU, rotation = 0): PbrSet {
  const one = (t: Texture) => {
    const c = t.clone();
    c.repeat.set(repeatU, repeatV);
    c.rotation = rotation;
    const img = t.image as HTMLImageElement | undefined;
    if (!(img?.complete && img.naturalWidth > 0)) {
      // copy() marks the clone for upload; hold it until the shared image has arrived.
      c.version = 0;
      followers.set(t, [...(followers.get(t) ?? []), c]);
    }
    return c;
  };
  return { colour: one(set.colour), normal: one(set.normal), arm: one(set.arm) };
}

/** Resolves when every texture requested so far has decoded. */
export function texturesLoaded(): Promise<void> {
  return Promise.all(pending).then(() => undefined);
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Low-frequency value noise for macro colour variation that breaks up tiling. */
export function macroNoise(size = 256): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  const r = seeded(11);
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = size * (0.04 + r() * 0.16);
    const v = Math.floor(r() * 255);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${v},${v},${v},0.35)`);
    g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    ctx.fillStyle = g;
    for (const dx of [-size, 0, size])
      for (const dy of [-size, 0, size]) {
        ctx.save();
        ctx.translate(dx, dy);
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
  }
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = NoColorSpace;
  return tex;
}

/** Soft round sprite for dust motes. */
export function softDot(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}
