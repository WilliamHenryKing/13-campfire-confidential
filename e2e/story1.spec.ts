import { expect, type Page, test } from "@playwright/test";
import { CHAPTERS } from "../src/game/chapters";
import { STEP } from "../src/game/state";

/** The key presses that move each prop of a chapter from its start to its known answer. */
function solveKeys(chapter: number): string[] {
  const ch = CHAPTERS[chapter];
  if (!ch) throw new Error("no chapter");
  return ch.props.flatMap((p, i) => {
    const keys = [String(i + 1)];
    const rep = (n: number, up: string, down: string) => {
      for (let k = 0; k < Math.abs(n); k++) keys.push(n > 0 ? up : down);
    };
    rep(Math.round((p.solution.z - p.start.z) / STEP.z), "=", "-");
    rep(Math.round((p.solution.x - p.start.x) / STEP.xy), "ArrowRight", "ArrowLeft");
    rep(Math.round((p.solution.y - p.start.y) / STEP.xy), "ArrowUp", "ArrowDown");
    rep((((p.solution.turn - p.start.turn) % 8) + 8) % 8, "q", "e");
    let tilt = (((p.solution.tilt - p.start.tilt) % 24) + 24) % 24;
    if (tilt > 12) tilt -= 24;
    rep(tilt, "z", "x");
    return keys;
  });
}

test("all four shadow stories, guide, hints, guarded page turns and replay", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/?e2e&intro");
  // The veil lifts after the first frame, then removes itself; either state means ready.
  await expect(page.locator("#arrival:not(.is-done)")).toHaveCount(0, { timeout: 120_000 });
  await expect(page.locator(".mute")).toBeHidden();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Light the lamp" }).click();
  await expect(page.getByRole("heading", { name: "The Mushroom" })).toBeVisible();
  await expect(page.locator(".meter-word")).not.toContainText("That's it!");

  const guide = page.getByLabel("Shadow guide", { exact: true });
  await expect(guide).toContainText("1/3");
  await page.keyboard.press("ArrowRight");
  await expect(guide).toContainText("2/3");
  await page.keyboard.press("=");
  await expect(guide).toContainText("3/3");
  await page.keyboard.press("h");
  await expect(page.getByRole("button", { name: "Trace the sketch on the tent" })).toBeEnabled();
  await page.keyboard.press("h");
  await expect(page.getByRole("button", { name: "Hints shown" })).toBeDisabled();
  await page.getByRole("button", { name: "Reset props to the start" }).click();
  for (let index = 0; index < CHAPTERS.length; index++) {
    await expect(
      page.getByRole("heading", { name: CHAPTERS[index]?.title, exact: true }),
    ).toBeVisible();
    await page.keyboard.press("2");
    await expect(page.locator('.chip[data-prop="1"]')).toBeFocused();
    for (const key of solveKeys(index)) await page.keyboard.press(key);
    const told = page.locator(".card-told");
    await expect(told).toBeVisible({ timeout: 8_000 });
    await expect(page.locator(".meter-word")).toContainText("That's it!");
    await expect(page.locator(".story .advice")).toHaveText("Secret told. Your shadow is saved.");
    await expect(guide).toHaveCount(0);
    await expect(page.locator(".scene")).toHaveAttribute("inert", "");
    await page.waitForTimeout(2400);
    await page.screenshot({ path: `test-results/story-${index + 1}.png` });
    const next = page.getByRole("button", {
      name: index === 3 ? "Close the case" : "Next story",
      exact: true,
    });
    await page.keyboard.press("Tab");
    const dialogSound = told.locator(".dialog-sound");
    await expect(dialogSound).toBeFocused();
    if (index === 0) {
      await page.keyboard.press("Space");
      await expect(dialogSound).toHaveAttribute("aria-pressed", "true");
      await page.keyboard.press("Space");
      await expect(dialogSound).toHaveAttribute("aria-pressed", "false");
    }
    await page.keyboard.press("Tab");
    await expect(next).toBeFocused();
    await next.evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
    await expect(told).toHaveCount(0);
    await expect(page.locator(".curtain")).not.toHaveClass(/is-on/);
  }
  await expect(page.getByRole("heading", { name: "Case closed", exact: true })).toBeVisible();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: "test-results/tableau.png" });
  await page.keyboard.press("Tab");
  const endSound = page.locator(".card-end .dialog-sound");
  await expect(endSound).toBeFocused();
  await page.keyboard.press("Tab");
  const replay = page.getByRole("button", { name: "Tell them again", exact: true });
  await expect(replay).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(endSound).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(replay).toBeFocused();
  await replay.click();
  await expect(page.locator(".card-end")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "The Mushroom", exact: true })).toBeVisible();
  await expect(page.locator('.chip[data-prop="0"]')).toBeFocused();
  await page.getByRole("button", { name: "Replay the guide", exact: true }).click();
  await expect(guide).toContainText("1/3");
  await page.getByRole("button", { name: "Skip the guide", exact: true }).click();

  await page.keyboard.press("m");
  await expect(page.getByRole("button", { name: /Sound off/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(errors).toEqual([]);
});

async function touchSolve(page: Page) {
  const actions: Record<string, string> = {
    ArrowLeft: "Move shadow left",
    ArrowRight: "Move shadow right",
    ArrowUp: "Move shadow up",
    ArrowDown: "Move shadow down",
    "=": "Bigger shadow (toward the lamp)",
    "-": "Smaller shadow (toward the tent)",
    q: "Turn the prop",
    e: "Turn the prop",
    z: "Tilt left",
    x: "Tilt right",
  };
  for (const key of solveKeys(0)) {
    if (/^[1-4]$/.test(key)) await page.locator(`.chip[data-prop="${Number(key) - 1}"]`).tap();
    else await page.getByRole("button", { name: actions[key], exact: true }).tap();
  }
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 568, height: 320 },
]) {
  test(`touch guide and mushroom at ${viewport.width}×${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:4623",
      viewport,
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/?e2e&intro");
    await expect(page.locator("#arrival:not(.is-done)")).toHaveCount(0, { timeout: 120000 });
    await page.screenshot({ path: `test-results/title-${viewport.width}.png` });
    await page.getByRole("button", { name: "Light the lamp", exact: true }).tap();
    await expect(page.getByLabel("Shadow guide", { exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/guide-${viewport.width}.png` });
    const guideBox = await page.locator(".shadow-guide").boundingBox();
    const pickerBox = await page.locator(".prop-picker").boundingBox();
    expect(guideBox).not.toBeNull();
    expect(pickerBox).not.toBeNull();
    expect((guideBox?.y ?? 0) + (guideBox?.height ?? 0)).toBeLessThanOrEqual(
      (pickerBox?.y ?? 0) + 1,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole("button", { name: "Move shadow right", exact: true }).tap();
    await expect(page.getByLabel("Shadow guide", { exact: true })).toContainText("2/3");
    await page.getByRole("button", { name: "Bigger shadow (toward the lamp)", exact: true }).tap();
    await expect(page.getByLabel("Shadow guide", { exact: true })).toContainText("3/3");
    await page.getByRole("button", { name: "Skip the guide", exact: true }).tap();
    await page.getByRole("button", { name: "Reset props to the start", exact: true }).tap();
    await touchSolve(page);
    await expect(page.locator(".card-told")).toBeVisible({ timeout: 8000 });
    const sound = page.locator(".card-told .dialog-sound");
    await sound.tap();
    await expect(sound).toHaveAttribute("aria-pressed", "true");
    await sound.tap();
    await expect(sound).toHaveAttribute("aria-pressed", "false");
    await page.screenshot({ path: `test-results/told-${viewport.width}.png` });
    await page.getByRole("button", { name: "Next story", exact: true }).tap();
    await expect(page.getByRole("heading", { name: "The Rabbit", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  });
}

test("live reduced motion completes the camera glide", async ({ page }) => {
  await page.goto("/?e2e&intro");
  await expect(page.locator("#arrival:not(.is-done)")).toHaveCount(0, { timeout: 120000 });
  await page.getByRole("button", { name: "Light the lamp", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByLabel("Shadow guide", { exact: true })).toBeVisible({ timeout: 1500 });
  await expect(page.locator(".hud")).toHaveAttribute("data-opening", "done");
});

test("a stationary two-finger gesture postpones a successful story until release", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4623",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?e2e");
  await expect(page.locator("#arrival:not(.is-done)")).toHaveCount(0, { timeout: 120000 });
  await page.getByRole("button", { name: "Skip the guide", exact: true }).tap();
  const input = await context.newCDPSession(page);
  for (const key of solveKeys(0)) await page.keyboard.press(key);
  await input.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 14, y: 250, id: 1 }],
  });
  await input.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: 14, y: 250, id: 1 },
      { x: 54, y: 250, id: 2 },
    ],
  });
  await page.waitForTimeout(700);
  await expect(page.locator(".card-told")).toHaveCount(0);
  await input.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.locator(".card-told")).toBeVisible({ timeout: 4000 });
  expect(errors).toEqual([]);
  await context.close();
});
