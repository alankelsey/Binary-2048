import { expect, test } from "@playwright/test";
import { DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameState } from "@/lib/binary2048/types";

test("rapid arrow keys stay ordered across instance recovery", async ({ page }) => {
  const initialGrid: Cell[][] = [
    [{ t: "n", v: 1 }, null, null, null],
    [null, null, null, null],
    [null, null, { t: "n", v: 1 }, null],
    [null, null, null, null]
  ];
  let current: GameState = {
    id: "g_rapid_0",
    config: { ...DEFAULT_CONFIG, seed: 991 },
    width: 4,
    height: 4,
    seed: 991,
    rngStep: 0,
    score: 0,
    turn: 0,
    won: false,
    over: false,
    grid: initialGrid
  };
  const expectedMoves: Dir[] = ["left", "down", "left", "down", "right", "left"];
  const completedMoves: Dir[] = [];
  let activeRequests = 0;
  let maximumActiveRequests = 0;
  let requestCount = 0;

  await page.addInitScript(() => {
    window.localStorage.removeItem("binary2048.currentGameId");
    window.localStorage.removeItem("binary2048.resumeSnapshot");
  });
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
          config: current.config,
          initialGrid,
          moves: []
        },
        undo: { limit: 2, used: 0, remaining: 2 },
        integrity: { sessionClass: "unranked", source: "created" }
      })
    });
  });
  await page.route("**/api/games/*/move", async (route) => {
    requestCount += 1;
    activeRequests += 1;
    maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
    const body = route.request().postDataJSON() as { dir: Dir; recoverySnapshot?: unknown };
    await new Promise((resolve) => setTimeout(resolve, 60));

    if (!body.recoverySnapshot) {
      activeRequests -= 1;
      await route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"Game not found"}' });
      return;
    }

    completedMoves.push(body.dir);
    current = {
      ...current,
      id: `g_rapid_${completedMoves.length}`,
      turn: completedMoves.length,
      score: completedMoves.length
    };
    activeRequests -= 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: current.id,
        current,
        lastStep: { events: [] },
        recoverySnapshot: {
          recoveryVersion: 1,
          rulesetId: "binary2048-v1",
          config: current.config,
          initialGrid,
          moves: completedMoves
        },
        undo: { limit: 2, used: 0, remaining: 2 },
        integrity: { sessionClass: "unranked", source: "imported" }
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as typeof window & { __binary2048Errors?: string[] }).__binary2048Errors = seen;
    new MutationObserver(() => {
      const message = document.querySelector(".status-error")?.textContent?.trim();
      if (message) seen.push(message);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });

  for (const dir of expectedMoves) {
    const key = { left: "ArrowLeft", down: "ArrowDown", right: "ArrowRight", up: "ArrowUp" }[dir];
    await page.keyboard.press(key);
  }

  await expect.poll(() => completedMoves.length, { timeout: 10_000 }).toBe(expectedMoves.length);
  expect(completedMoves).toEqual(expectedMoves);
  expect(requestCount).toBe(expectedMoves.length);
  expect(maximumActiveRequests).toBe(1);
  await expect(page.getByText(`Moves: ${expectedMoves.length}`)).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as typeof window & { __binary2048Errors?: string[] }).__binary2048Errors ?? []
    )
  ).toEqual([]);
});
