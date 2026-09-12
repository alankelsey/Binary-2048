import { expect, test } from "@playwright/test";

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
  await expect(page.getByRole("button", { name: "Show Controls" })).toBeVisible();
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
  expect(staleMoveRequests).toBe(2);
  expect(restoredMoveRequests).toBe(1);
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
