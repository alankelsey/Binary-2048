import { expect, test } from "@playwright/test";
import { applyMove, createGame, DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameConfig, GameState } from "@/lib/binary2048/types";

test("special tiles render and resolve through a browser move", async ({ page }) => {
  const config: GameConfig = {
    ...DEFAULT_CONFIG,
    seed: 731,
    spawn: {
      pZero: 0,
      pOne: 1,
      pWildcard: 0,
      pLock: 0,
      wildcardMultipliers: [2]
    }
  };
  const initialGrid: Cell[][] = [
    [{ t: "z" }, { t: "n", v: 8 }, null, null],
    [{ t: "w", m: 2 }, { t: "n", v: 4 }, null, null],
    [{ t: "i" }, { t: "n", v: 2 }, null, null],
    [null, null, null, null]
  ];
  const created = createGame(config, initialGrid).state;
  let current: GameState = { ...created, turn: 1, over: false };
  let lastMoveChanged = false;
  let lockBreakCount = 0;
  let createRequests = 0;

  await page.addInitScript(() => {
    window.localStorage.removeItem("binary2048.currentGameId");
    window.localStorage.removeItem("binary2048.resumeSnapshot");
  });
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    createRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: current.id,
        current,
        recoverySnapshot: {
          recoveryVersion: 1,
          rulesetId: "binary2048-v1",
          config,
          initialGrid,
          moves: []
        },
        undo: { limit: 0, used: 0, remaining: 0 },
        integrity: { sessionClass: "unranked", source: "created" }
      })
    });
  });
  await page.route("**/api/games/*/move", async (route) => {
    const body = route.request().postDataJSON() as { dir: Dir };
    const result = applyMove(current, body.dir);
    current = result.state;
    lastMoveChanged = result.moved;
    lockBreakCount = result.events.filter((event) => event.type === "lock_break").length;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: current.id,
        current,
        lastStep: { events: result.events },
        undo: { limit: 0, used: 0, remaining: 0 },
        integrity: { sessionClass: "unranked", source: "created" }
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.getByRole("gridcell", { name: "row 1 column 1 zero" })).toBeVisible();
  await expect(page.getByRole("gridcell", { name: "row 2 column 1 wildcard" })).toBeVisible();
  await expect(page.getByRole("gridcell", { name: "row 3 column 1 lock zero" })).toBeVisible();

  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => current.turn).toBe(2);
  await expect(page.getByRole("gridcell", { name: /zero$/ })).toHaveCount(0);
  await expect(page.getByRole("gridcell", { name: /wildcard$/ })).toHaveCount(0);
  await expect(page.getByRole("gridcell", { name: /lock zero$/ })).toHaveCount(0);
  await expect(page.getByText("Score: 18").first()).toBeVisible();

  expect(lastMoveChanged).toBe(true);
  expect(lockBreakCount).toBe(1);
  expect(createRequests).toBe(1);
});
