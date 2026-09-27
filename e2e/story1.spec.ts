import { expect, test } from "@playwright/test";
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

test("story 1 can be told with the keyboard, and the reveal follows", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/");
  await expect(page.locator("#arrival")).toHaveClass(/is-done/, { timeout: 20_000 });
  await page.getByRole("button", { name: "Light the lamp" }).click();
  await expect(page.getByRole("heading", { name: "The Mushroom" })).toBeVisible();
  await expect(page.locator(".meter-word")).not.toContainText("That's it!");

  for (const key of solveKeys(0)) await page.keyboard.press(key);

  const told = page.locator(".card-told");
  await expect(told).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".meter-word")).toContainText("That's it!");
  await expect(told.locator(".line.is-shown").last()).toContainText("Nobody is allowed", {
    timeout: 6_000,
  });
  await expect(page.getByRole("button", { name: "Next story" })).toBeFocused();

  await page.getByRole("button", { name: "Next story" }).click();
  await expect(page.getByRole("heading", { name: "The Rabbit" })).toBeVisible({ timeout: 5_000 });

  await page.keyboard.press("m");
  await expect(page.getByRole("button", { name: /Sound off/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(errors).toEqual([]);
});
