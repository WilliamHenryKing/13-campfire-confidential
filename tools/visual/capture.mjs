// Capture every camera bookmark from a running build (bun run build && bun run preview) into
// docs/visual/captures/<set>/. Headless Chromium on SwiftShader, so results are reproducible
// without a GPU. Usage: node tools/visual/capture.mjs <set> [baseUrl]
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const set = process.argv[2] ?? "latest";
const base = process.argv[3] ?? "http://127.0.0.1:4623/";
const out = new URL(`../../docs/visual/captures/${set}/`, import.meta.url);
await mkdir(out, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const probe = await browser.newPage();
await probe.goto(`${base}?e2e`);
await probe.waitForFunction(() => window.__VISUAL_TEST__, null, { timeout: 30_000 });
const bookmarks = await probe.evaluate(() => window.__VISUAL_TEST__.bookmarks);
await probe.close();

const log = [];
for (const name of bookmarks) {
  const phone = name.startsWith("phone");
  const page = await browser.newPage({
    viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: phone ? 2 : 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${base}?e2e`);
  await page.waitForFunction(() => window.__VISUAL_TEST__, null, { timeout: 30_000 });
  const renderer = await page.evaluate(async (bookmark) => {
    const v = window.__VISUAL_TEST__;
    await v.ready;
    v.hud(false);
    v.story(0, true);
    v.setBookmark(bookmark);
    await v.settle(12);
    v.freeze();
    await v.settle(6);
    return v.renderer();
  }, name);
  await page.screenshot({ path: new URL(`${name}.png`, out).pathname });
  log.push(`${name}: ${renderer}${errors.length ? ` | errors: ${errors.join("; ")}` : ""}`);
  console.log(log.at(-1));
  await page.close();
}
await writeFile(
  new URL("renderer.txt", out),
  `Captured ${new Date().toISOString()} from ${base}\n${log.join("\n")}\n`,
);
await browser.close();
