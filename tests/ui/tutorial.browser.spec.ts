import { expect, test, type Page } from "@playwright/test";
import { createGame, DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import { TUTORIAL_LESSONS } from "@/lib/binary2048/tutorial";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

const keyForDirection = {
  left: "ArrowLeft",
  right: "ArrowRight",
  up: "ArrowUp",
  down: "ArrowDown"
} as const;

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
        recoverySnapshot: {
          recoveryVersion: 1,
          rulesetId: "binary2048-v1",
          config: normalGameConfig,
          initialGrid,
          moves: []
        },
        undo: { limit: 2, used: 0, remaining: 2 },
        integrity: { sessionClass: "unranked", source: "created" }
      })
    });
  });
}

test("first visit can dismiss the tutorial prompt without creating a game", async ({ page }) => {
  let createRequests = 0;
  await page.route("**/api/games", async (route) => {
    createRequests += 1;
    await route.abort();
  });

  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "LEARN TO PLAY" })).toBeVisible();
  await page.getByRole("button", { name: "Not Now" }).click();
  await expect(page.getByRole("dialog", { name: "NEW GAME" })).toBeVisible();
  expect(createRequests).toBe(0);

  await page.reload();
  await expect(page.getByRole("dialog", { name: "LEARN TO PLAY" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "NEW GAME" })).toBeVisible();
});

test("guided tutorial covers every authored lesson and finishes at a new-game state", async ({ page }) => {
  let gameplayRequests = 0;
  await page.route("**/api/games**", async (route) => {
    gameplayRequests += 1;
    await route.abort();
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start Tutorial" }).click();
  await expect(page.getByRole("grid", { name: "Binary 2048 tutorial board" })).toBeVisible();

  const firstBoard = await page.getByRole("gridcell").evaluateAll((cells) =>
    cells.map((cell) => cell.getAttribute("aria-label"))
  );
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".tutorial-feedback")).toContainText("Try left");
  expect(await page.getByRole("gridcell").evaluateAll((cells) =>
    cells.map((cell) => cell.getAttribute("aria-label"))
  )).toEqual(firstBoard);

  for (let index = 0; index < TUTORIAL_LESSONS.length; index += 1) {
    const lesson = TUTORIAL_LESSONS[index];
    await expect(page.getByRole("heading", { name: lesson.title })).toBeVisible();
    for (const dir of lesson.expectedMoves) {
      await page.keyboard.press(keyForDirection[dir]);
    }
    await expect(page.locator(".tutorial-feedback")).toHaveText(lesson.outcome);
    if (index < TUTORIAL_LESSONS.length - 1) {
      await page.getByRole("button", { name: "Next Lesson" }).click();
    }
  }

  await expect(page.getByRole("gridcell", { name: /number 2048$/ })).toHaveCount(1);
  await expect(page.getByRole("status", { name: "Tutorial complete" })).toContainText("Wildcards multiply numbers");
  await page.getByRole("button", { name: "Finish Tutorial" }).click();
  await expect(page.getByRole("dialog", { name: "NEW GAME" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tutorial", exact: true })).toBeVisible();
  expect(gameplayRequests).toBe(0);
});

test("refresh restarts the current authored lesson and exiting returns to new game", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start Tutorial" }).click();
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("button", { name: "Next Lesson" }).click();

  const initialLessonBoard = await page.getByRole("gridcell").evaluateAll((cells) =>
    cells.map((cell) => cell.getAttribute("aria-label"))
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: TUTORIAL_LESSONS[1].title })).toBeVisible();
  expect(await page.getByRole("gridcell").evaluateAll((cells) =>
    cells.map((cell) => cell.getAttribute("aria-label"))
  )).toEqual(initialLessonBoard);

  await page.getByRole("button", { name: "Exit Tutorial", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "EXIT TUTORIAL?" })).toBeVisible();
  await page.getByRole("button", { name: "Exit Tutorial", exact: true }).last().click();
  await expect(page.getByRole("dialog", { name: "NEW GAME" })).toBeVisible();
});

test("launching from an active game is gated and cancellation preserves the board", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("binary2048.tutorial.v1", '{"version":1,"status":"dismissed"}');
    window.localStorage.removeItem("binary2048.currentGameId");
    window.localStorage.removeItem("binary2048.resumeSnapshot");
  });
  await mockNormalGame(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  const boardBefore = await page.getByRole("gridcell").evaluateAll((cells) =>
    cells.map((cell) => cell.getAttribute("aria-label"))
  );

  await page.getByRole("button", { name: "Tutorial", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "END CURRENT GAME?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep Playing" }).click();
  expect(await page.getByRole("gridcell").evaluateAll((cells) =>
    cells.map((cell) => cell.getAttribute("aria-label"))
  )).toEqual(boardBefore);

  await page.getByRole("button", { name: "Tutorial", exact: true }).click();
  await page.getByRole("button", { name: "End Game and Start Tutorial" }).click();
  await expect(page.getByRole("grid", { name: "Binary 2048 tutorial board" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("binary2048.currentGameId"))).toBeNull();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("binary2048.resumeSnapshot"))).toBeNull();
});
