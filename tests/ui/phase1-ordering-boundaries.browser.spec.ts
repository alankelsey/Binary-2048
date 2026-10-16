import { expect, test } from "@playwright/test";
import { applyMove, DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameState } from "@/lib/binary2048/types";
import { gameStateHash, STATE_HASH_VERSION } from "@/lib/binary2048/state-identity";

const initialGrid: Cell[][] = [
  [{ t: "n", v: 1 }, null, null, null],
  [null, null, null, null],
  [null, null, null, null],
  [null, null, null, null]
];

function gameState(id: string, turn = 0, score = 0): GameState {
  return {
    id,
    config: { ...DEFAULT_CONFIG, seed: 8192 },
    width: 4,
    height: 4,
    seed: 8192,
    rngStep: turn,
    score,
    turn,
    won: false,
    over: false,
    grid: initialGrid
  };
}

function createdGamePayload(current: GameState) {
  return {
    id: current.id,
    current,
    recoverySnapshot: {
      recoveryVersion: 1,
      rulesetId: "binary2048-v1",
      sessionId: current.id,
      config: current.config,
      initialGrid,
      moves: []
    },
    undo: { limit: 2, used: 0, remaining: 2 },
    integrity: { sessionClass: "unranked", source: "created" }
  };
}

async function prepareGuest(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem("binary2048.currentGameId");
    window.localStorage.removeItem("binary2048.resumeSnapshot");
    window.localStorage.setItem("binary2048.tutorial.v1", '{"version":1,"status":"dismissed"}');
    document.cookie = "binary2048_tutorial_suppress=1; Path=/; SameSite=Lax";
    performance.clearMarks();
    performance.clearMeasures();
  });
}

test("serializes delayed moves and keeps draining after a no-op response", async ({ page }) => {
  let current = gameState("g_serial_noop");
  const requestDirections: Dir[] = [];
  let activeRequests = 0;
  let maximumActiveRequests = 0;

  await prepareGuest(page);
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(createdGamePayload(current)) });
  });
  await page.route("**/api/games/*/move", async (route) => {
    const { dir } = route.request().postDataJSON() as { dir: Dir };
    requestDirections.push(dir);
    activeRequests += 1;
    maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
    const requestNumber = requestDirections.length;
    await new Promise((resolve) => setTimeout(resolve, requestNumber === 1 ? 300 : requestNumber === 2 ? 20 : 100));
    current = applyMove(current, dir).state;
    const responseBody = JSON.stringify({
      id: current.id,
      current,
      stateHash: gameStateHash(current),
      stateHashVersion: STATE_HASH_VERSION,
      lastStep: { moved: requestNumber > 1, events: [] },
      recoverySnapshot: {
        recoveryVersion: 1,
        rulesetId: "binary2048-v1",
        sessionId: current.id,
        config: current.config,
        initialGrid,
        moves: requestDirections
      },
      undo: { limit: 2, used: 0, remaining: 2 },
      integrity: { sessionClass: "unranked", source: "created" }
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: responseBody });
    activeRequests -= 1;
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
  await page.evaluate(() => {
    for (const key of ["ArrowLeft", "ArrowDown", "ArrowRight"]) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    }
  });

  await page.waitForTimeout(75);
  expect(requestDirections).toEqual(["left"]);
  expect(maximumActiveRequests).toBe(1);
  await expect.poll(() => requestDirections.length, { timeout: 10_000 }).toBe(3);
  await expect.poll(() =>
    page.evaluate(() => performance.getEntriesByName("binary2048:move-complete").length)
  ).toBe(3);
  expect(requestDirections).toEqual(["left", "down", "right"]);
  expect(maximumActiveRequests).toBe(1);
  expect(await page.evaluate(() => performance.getEntriesByName("binary2048:move-dropped").length)).toBe(0);
  await expect(page.locator(".meta")).toContainText("Moves: 2");
});

test("isolates new-game modal and replacement-session inputs", async ({ page }) => {
  const oldGame = gameState("g_before_new_game");
  const replacementGame = gameState("g_after_new_game");
  let createRequests = 0;
  const moveSessionIds: string[] = [];
  const moveDirections: Dir[] = [];

  await prepareGuest(page);
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const current = createRequests === 0 ? oldGame : replacementGame;
    createRequests += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(createdGamePayload(current)) });
  });
  await page.route("**/api/games/*/move", async (route) => {
    const url = new URL(route.request().url());
    const sessionId = url.pathname.split("/").at(-2) ?? "";
    const { dir } = route.request().postDataJSON() as { dir: Dir };
    moveSessionIds.push(sessionId);
    moveDirections.push(dir);
    const base = sessionId === replacementGame.id ? replacementGame : oldGame;
    const current = applyMove(base, dir).state;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: sessionId,
        current,
        stateHash: gameStateHash(current),
        stateHashVersion: STATE_HASH_VERSION,
        lastStep: { moved: true, events: [] },
        undo: { limit: 2, used: 0, remaining: 2 },
        integrity: { sessionClass: "unranked", source: "created" }
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
  await page.getByRole("button", { name: "New Game", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "NEW GAME" })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  expect(moveSessionIds).toHaveLength(0);
  const modalDrop = await page.evaluate(() =>
    (performance.getEntriesByName("binary2048:move-dropped")[0] as PerformanceMark).detail
  );
  expect(modalDrop).toMatchObject({ source: "keyboard", direction: "left", dropReason: "modal_open" });

  await page.keyboard.press("Escape");
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => moveSessionIds.length).toBe(1);
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
  expect(moveSessionIds).toEqual([oldGame.id]);

  await page.getByRole("button", { name: "New Game", exact: true }).click();
  await page.getByRole("button", { name: "Confirm New Game" }).click();
  const newGameDialog = page.getByRole("dialog", { name: "NEW GAME" });
  await expect(newGameDialog).toBeVisible();
  await newGameDialog.getByRole("button", { name: "Start New Game" }).click();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("binary2048.currentGameId"))).toBe(replacementGame.id);
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");

  await page.keyboard.press("ArrowRight");
  await expect.poll(() => moveSessionIds.length).toBe(2);
  expect(moveSessionIds).toEqual([oldGame.id, replacementGame.id]);
  expect(moveDirections).toEqual(["down", "right"]);
});
