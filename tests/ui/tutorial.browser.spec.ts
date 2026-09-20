import { expect, test, type Page } from "@playwright/test";
import { createGame, DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import { TUTORIAL_LESSONS } from "@/lib/binary2048/tutorial";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

const keyForDirection = { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown" } as const;
const normalGameConfig: GameConfig = {
  ...DEFAULT_CONFIG,
  seed: 8128,
  spawn: { pZero: 0, pOne: 1, pWildcard: 0, pLock: 0, wildcardMultipliers: [2] }
};

async function mockNormalGame(page: Page) {
  const initialGrid: Cell[][] = [
    [{ t: "n", v: 2 }, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, { t: "n", v: 2 }, null, null]
  ];
  const current = createGame(normalGameConfig, initialGrid).state;
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: current.id,
        current,
        recoverySnapshot: { recoveryVersion: 1, rulesetId: "binary2048-v1", config: normalGameConfig, initialGrid, moves: [] },
        undo: { limit: 2, used: 0, remaining: 2 },
        integrity: { sessionClass: "unranked", source: "created" }
      })
    });
  });
}

test("empty state exposes game, tutorial, and one-tap options with cookie suppression", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/");
  const empty = page.getByRole("dialog", { name: "NEW GAME" });
  await expect(empty).toBeVisible();
  await expect(empty.getByRole("button", { name: "Start New Game" })).toBeVisible();
  await expect(empty.getByRole("button", { name: "Play tutorial" })).toBeVisible();
  await expect(empty.getByText("New here?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Options", exact: true })).toHaveCount(1);
  await empty.getByRole("button", { name: "Options" }).click();
  await expect(page.getByRole("dialog", { name: "Options" })).toBeVisible();
  await expect(page.getByLabel("Difficulty", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await empty.getByRole("checkbox", { name: "Don't show this again" }).check();
  await expect.poll(async () => (await context.cookies()).some((cookie) => cookie.name === "binary2048_tutorial_suppress")).toBe(true);
  await page.reload();
  await expect(page.getByRole("dialog", { name: "NEW GAME" })).toBeVisible();
  await expect(page.getByText("New here?")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Play tutorial" })).toBeVisible();
});

test("guided tutorial automatically advances through every lesson without gameplay APIs", async ({ page }) => {
  let gameplayRequests = 0;
  await page.route("**/api/games**", async (route) => {
    gameplayRequests += 1;
    await route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Play tutorial" }).click();
  const firstBoard = await page.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")));
  await page.keyboard.press("ArrowLeft");
  expect(await page.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")))).toEqual(firstBoard);
  for (let lessonIndex = 0; lessonIndex < TUTORIAL_LESSONS.length; lessonIndex += 1) {
    const lesson = TUTORIAL_LESSONS[lessonIndex];
    for (let moveIndex = 0; moveIndex < lesson.expectedMoves.length; moveIndex += 1) {
      const coach = page.getByRole("dialog", { name: lesson.title });
      await expect(coach).toBeVisible();
      await expect(coach.locator(".tutorial-swipe-arrow")).toHaveAttribute("data-direction", lesson.expectedMoves[moveIndex]);
      await coach.getByRole("button", { name: "Try it" }).click();
      if (lessonIndex === 0 && moveIndex === 0) {
        await page.keyboard.press("ArrowRight");
        await expect(page.locator(".tutorial-feedback-float")).toHaveText("Try left.");
        expect(await page.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")))).toEqual(firstBoard);
      }
      await page.keyboard.press(keyForDirection[lesson.expectedMoves[moveIndex]]);
      if (lessonIndex === TUTORIAL_LESSONS.length - 1) break;
      await expect(page.locator(".tutorial-success")).toContainText("Good job!");
    }
  }
  await expect(page.getByRole("gridcell", { name: /number 2048$/ })).toHaveCount(1);
  await expect(page.getByRole("dialog", { name: "You made 2048!" })).toContainText("Lock-0 blocks once");
  await expect(page.getByRole("button", { name: "Next lesson" })).toHaveCount(0);
  await page.getByRole("button", { name: "Start playing" }).click();
  await expect(page.getByRole("dialog", { name: "NEW GAME" })).toBeVisible();
  await expect(page.getByText("New here?")).toBeVisible();
  expect(gameplayRequests).toBe(0);
});

for (const viewport of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 412, height: 915 }]) {
  test(`tutorial coach and board fit the mobile viewport at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button", { name: "Play tutorial" }).click();
    const board = await page.getByRole("grid", { name: "Binary 2048 tutorial board" }).boundingBox();
    const coach = await page.getByRole("dialog", { name: TUTORIAL_LESSONS[0].title }).boundingBox();
    expect(board).not.toBeNull();
    expect(coach).not.toBeNull();
    expect(board!.y + board!.height).toBeLessThanOrEqual(viewport.height);
    expect(coach!.y + coach!.height).toBeLessThanOrEqual(viewport.height);
    const targets = await page.getByRole("dialog", { name: TUTORIAL_LESSONS[0].title }).getByRole("button").evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().height)
    );
    expect(targets.every((height) => height >= 44)).toBe(true);
  });
}

test("direction cue becomes static when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Play tutorial" }).click();
  await expect(page.locator(".tutorial-swipe-arrow")).toHaveCSS("animation-name", "none");
});

test("tap-to-try accepts a real tutorial swipe gesture", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play tutorial" }).click();
  await page.getByRole("button", { name: "Try it" }).click();
  await page.getByRole("grid", { name: "Binary 2048 tutorial board" }).evaluate((board) => {
    const start = new Touch({ identifier: 1, target: board, clientX: 260, clientY: 240 });
    const end = new Touch({ identifier: 1, target: board, clientX: 120, clientY: 240 });
    board.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [start] }));
    board.dispatchEvent(new TouchEvent("touchend", { bubbles: true, changedTouches: [end] }));
  });
  await expect(page.locator(".tutorial-success")).toContainText("Good job!");
});

test("refresh restarts the current lesson and quit returns to empty state", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play tutorial" }).click();
  await page.getByRole("button", { name: "Try it" }).click();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("dialog", { name: TUTORIAL_LESSONS[1].title })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog", { name: TUTORIAL_LESSONS[1].title })).toBeVisible();
  await page.getByRole("button", { name: "Try it" }).click();
  await page.getByRole("button", { name: "Quit tutorial" }).click();
  await expect(page.getByRole("dialog", { name: "EXIT TUTORIAL?" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "EXIT TUTORIAL?" })).toHaveCount(0);
  await page.getByRole("button", { name: "Quit tutorial" }).click();
  await page.getByRole("button", { name: "Leave tutorial" }).click();
  await expect(page.getByRole("dialog", { name: "NEW GAME" })).toBeVisible();
});

test("launching from an active game is gated and cancellation preserves the board", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("binary2048.currentGameId");
    window.localStorage.removeItem("binary2048.resumeSnapshot");
  });
  await mockNormalGame(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  const boardBefore = await page.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")));
  await page.getByRole("button", { name: "Tutorial", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "END CURRENT GAME?" })).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await page.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")))).toEqual(boardBefore);
  await page.getByRole("button", { name: "Tutorial", exact: true }).click();
  await page.getByRole("button", { name: "End game and start tutorial" }).click();
  await expect(page.getByRole("grid", { name: "Binary 2048 tutorial board" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("binary2048.currentGameId"))).toBeNull();
});
