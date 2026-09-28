// README media from a running build (bun run build && bun run preview): desktop.png,
// phone.png and preview.gif in docs/readme/. The GIF is assembled frame by frame through the
// capture hook, so it plays smoothly however slowly the machine renders.
// Usage: node tools/visual/readme-media.mjs [baseUrl]   (needs ffmpeg on PATH)
import { execFileSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://127.0.0.1:4623/";
const out = new URL("../../docs/readme/", import.meta.url).pathname;
const frames = new URL("../../.readme-frames/", import.meta.url).pathname;
const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

async function open(viewport, scale, query = "") {
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale });
  await page.addInitScript(() => localStorage.setItem("campfire-confidential:coached", "1"));
  await page.goto(`${base}?e2e&tier=high${query}`);
  await page.waitForFunction(() => window.__VISUAL_TEST__, null, { timeout: 60_000 });
  await page.evaluate(() => window.__VISUAL_TEST__.ready);
  return page;
}
const hook = (page, fn, ...args) => page.evaluate(fn, ...args);

// Desktop: the rabbit just told, traced in gold.
{
  const page = await open({ width: 1440, height: 900 }, 1);
  await hook(page, () => window.__VISUAL_TEST__.story(1, true));
  await hook(page, () => window.__VISUAL_TEST__.settle(4));
  await hook(page, () => window.__VISUAL_TEST__.freeze(false));
  await hook(page, () => window.__VISUAL_TEST__.tell());
  await page.waitForTimeout(3500);
  await hook(page, () => window.__VISUAL_TEST__.settle(3));
  await page.screenshot({ path: `${out}desktop.png` });
  await page.close();
}

// Phone at 2x: the rabbit taking shape, advice showing.
{
  const page = await open({ width: 390, height: 844 }, 2);
  await hook(page, () => window.__VISUAL_TEST__.between(1, 0.72));
  await page.keyboard.press("h");
  await hook(page, () => window.__VISUAL_TEST__.settle(4));
  await page.screenshot({ path: `${out}phone.png` });
  await page.close();
}

// Preview GIF: story 1 forms from scattered props, then is told and comes alive.
{
  await rm(frames, { recursive: true, force: true });
  await mkdir(frames, { recursive: true });
  const page = await open({ width: 800, height: 500 }, 1);
  let n = 0;
  const shot = async () => {
    await page.screenshot({ path: `${frames}${String(n++).padStart(4, "0")}.png` });
  };
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  // Time stands still while the props move, so only the figure changes between frames.
  await hook(page, () => window.__VISUAL_TEST__.freeze(true));
  for (let i = 0; i < 10; i++) {
    await hook(page, () => window.__VISUAL_TEST__.between(0, 0));
    await hook(page, () => window.__VISUAL_TEST__.settle(1));
    await shot();
  }
  for (let i = 0; i <= 36; i++) {
    await hook(page, (t) => window.__VISUAL_TEST__.between(0, t), ease(i / 36));
    await hook(page, () => window.__VISUAL_TEST__.settle(1));
    await shot();
  }
  await hook(page, () => window.__VISUAL_TEST__.freeze(false));
  await hook(page, () => window.__VISUAL_TEST__.tell());
  for (let i = 0; i < 24; i++) {
    await hook(page, () => window.__VISUAL_TEST__.settle(1));
    await shot();
  }
  // Hold on the told story; frozen frames are identical and cost almost nothing.
  await hook(page, () => window.__VISUAL_TEST__.freeze(true));
  for (let i = 0; i < 14; i++) await shot();
  await page.close();
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-framerate",
    "10",
    "-i",
    `${frames}%04d.png`,
    "-filter_complex",
    "[0:v]split[a][b];[a]palettegen=max_colors=64:stats_mode=full[p];[b][p]paletteuse=dither=none",
    "-gifflags",
    "0",
    "-loop",
    "0",
    `${out}preview.gif`,
  ]);
  await rm(frames, { recursive: true, force: true });
}
await browser.close();
