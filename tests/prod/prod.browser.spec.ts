import { expect, test } from "@playwright/test";
import { applyMove, createGame, DEFAULT_CONFIG, generateBitstormInitialGrid } from "@/lib/binary2048/engine";
import type { Dir, GameConfig, GameState } from "@/lib/binary2048/types";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("binary2048.tutorial.v1", '{"version":1,"status":"dismissed"}');
    document.cookie = "binary2048_tutorial_suppress=1; Path=/; SameSite=Lax";
  });
});

test("prod home renders core app shell", async ({ page }) => {
  const response = await page.goto("/");
  expect(response).toBeTruthy();
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Binary 2048" })).toBeVisible();
});

test("the empty mobile board shows a start overlay after recovery finishes", async ({ page }) => {
  const staleGameId = "g_ui_startup";
  let createRequests = 0;

  await page.setViewportSize({ width: 412, height: 915 });

  await page.addInitScript((gameId) => {
    window.localStorage.setItem("binary2048.currentGameId", gameId);
    window.localStorage.removeItem("binary2048.resumeSnapshot");
  }, staleGameId);

  await page.route(`**/api/games/${staleGameId}`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 750));
    await route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"not found"}' });
  });
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    createRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "g_ui_created",
        current: {
          id: "g_ui_created",
          width: 4,
          height: 4,
          seed: 123,
          rngStep: 2,
          score: 0,
          turn: 0,
          won: false,
          over: false,
          grid: [
            [{ t: "n", v: 1 }, null, null, null],
            [null, null, null, null],
            [null, null, { t: "n", v: 1 }, null],
            [null, null, null, null]
          ]
        },
        undo: { limit: 0, used: 0, remaining: 0 }
      })
    });
  });

  await page.goto("/");
  await expect(page.getByLabel("New game choices")).toBeVisible();
  await expect(page.getByRole("button", { name: "Options" })).toHaveCount(0);
  const startButton = page.getByRole("button", { name: "Start New Game" });
  await expect(startButton).toBeVisible();
  await startButton.click();
  await expect(page.getByRole("button", { name: "Starting…" })).toBeVisible();
  await expect(page.getByRole("gridcell", { name: /number 1$/ })).toHaveCount(2);
  expect(createRequests).toBe(1);
});

test("a stale instance-local session is recovered and moved atomically", async ({ page }) => {
  let staleMoveRequests = 0;
  let restoredMoveRequests = 0;
  const grid = [
    [null, { t: "n", v: 1 }, null, null],
    [null, null, null, null],
    [null, null, { t: "n", v: 1 }, null],
    [null, null, null, null]
  ];
  const state = (id: string, turn = 0, movedGrid = grid) => ({
    id,
    width: 4,
    height: 4,
    seed: 456,
    rngStep: 2,
    score: 0,
    turn,
    won: false,
    over: false,
    grid: movedGrid
  });

  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "g_before_sleep", current: state("g_before_sleep") })
    });
  });
  await page.route("**/api/games/g_before_sleep/move", async (route) => {
    staleMoveRequests += 1;
    const body = route.request().postDataJSON();
    if (!body.recoverySnapshot) {
      await route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"not found"}' });
      return;
    }
    restoredMoveRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "g_after_resume",
        current: state("g_after_resume", 1, [
          [{ t: "n", v: 2 }, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null]
        ]),
        recoverySnapshot: body.recoverySnapshot
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.getByRole("gridcell", { name: /number 1$/ })).toHaveCount(2);
  await page.evaluate(() => {
    window.localStorage.setItem(
      "binary2048.resumeSnapshot",
      JSON.stringify({
        gameId: "g_before_sleep",
        savedAtISO: new Date().toISOString(),
        exported: { recoveryVersion: 1, rulesetId: "binary2048-v1", config: {}, initialGrid: [], moves: [] }
      })
    );
  });

  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("gridcell", { name: /number 2$/ })).toHaveCount(1);
  expect(staleMoveRequests).toBe(1);
  expect(restoredMoveRequests).toBe(1);
});

test("the manual left-down and right-left loop reaches the game-over overlay", async ({ page }) => {
  const config: GameConfig = {
    ...DEFAULT_CONFIG,
    seed: 980960020,
    spawn: {
      pZero: 0.15,
      pOne: 0.73,
      pWildcard: 0.04,
      pLock: 0.08,
      wildcardMultipliers: [2]
    }
  };
  const initialGrid = generateBitstormInitialGrid(config);
  let current: GameState = createGame(config, initialGrid).state;
  const createdId = current.id;
  const moves: Dir[] = [];
  const movedResults: boolean[] = [];
  let createRequests = 0;

  await page.addInitScript(() => {
    window.localStorage.removeItem("binary2048.currentGameId");
    window.localStorage.removeItem("binary2048.resumeSnapshot");
    window.localStorage.setItem("binary2048.spawnMode", "death");
    window.localStorage.setItem("binary2048.gameMode", "bitstorm");
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
        integrity: { sessionClass: "unranked", source: "created" },
        mode: "bitstorm"
      })
    });
  });
  await page.route("**/api/games/*/move", async (route) => {
    const body = route.request().postDataJSON() as { dir: Dir };
    const result = applyMove(current, body.dir);
    current = result.state;
    moves.push(body.dir);
    movedResults.push(result.moved);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: current.id,
        current,
        lastStep: { events: result.events },
        recoverySnapshot: {
          recoveryVersion: 1,
          rulesetId: "binary2048-v1",
          config,
          initialGrid,
          moves
        },
        undo: { limit: 0, used: 0, remaining: 0 },
        integrity: { sessionClass: "unranked", source: "created" }
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.getByText("Difficulty: Death by AI")).toBeVisible();
  await expect(page.getByText("Mode: Bitstorm")).toBeVisible();

  async function press(dir: Dir) {
    const key = { left: "ArrowLeft", down: "ArrowDown", right: "ArrowRight", up: "ArrowUp" }[dir];
    await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
    const before = moves.length;
    await page.keyboard.press(key);
    await expect.poll(() => moves.length).toBe(before + 1);
    await expect(page.locator(".score-pill")).toHaveText(`Score: ${current.score}`);
    await expect(page.locator(".meta span").filter({ hasText: /^Moves: / })).toHaveText(`Moves: ${current.turn}`);
    await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
    return movedResults.at(-1) ?? false;
  }

  let probeCycles = 0;
  for (let cycle = 0; cycle < 250 && !current.over; cycle += 1) {
    const movedLeft = await press("left");
    if (current.over) break;
    const movedDown = await press("down");
    if (current.over) break;
    if (!movedLeft && !movedDown) {
      probeCycles += 1;
      await press("right");
      if (current.over) break;
      await press("left");
    }
  }

  expect(probeCycles).toBeGreaterThan(0);
  expect(current.over).toBe(true);
  expect(current.id).toBe(createdId);
  expect(createRequests).toBe(1);
  const gameOver = page.getByRole("dialog", { name: "GAME OVER" });
  await expect(gameOver).toBeVisible();
  await expect(gameOver.getByText(`Score: ${current.score}`)).toBeVisible();
  await expect(gameOver.getByRole("button", { name: "Replay JSON" })).toBeVisible();

  const terminalMoveCount = moves.length;
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => moves.length).toBe(terminalMoveCount);
});

test("prod auth page renders and does not show server configuration error", async ({ page }) => {
  const response = await page.goto("/auth");
  expect(response).toBeTruthy();
  expect(response?.status()).toBe(200);
  await expect(page.getByText("There is a problem with the server configuration.")).toHaveCount(0);
});

test("prod auth/session APIs are healthy from browser context", async ({ page, request }) => {
  await page.goto("/");

  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  const healthJson = await health.json();
  expect(healthJson.ok).toBe(true);

  const providers = await request.get("/api/auth/providers");
  expect(providers.status()).toBe(200);
  const providerJson = await providers.json();
  expect(Object.keys(providerJson)).toContain("github");
});
