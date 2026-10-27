import { expect, test } from "@playwright/test";

test("offers a responsive cherry-blossom board with opaque HTML tiles", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.localStorage.removeItem("binary2048.currentGameId");
    window.localStorage.removeItem("binary2048.resumeSnapshot");
    window.localStorage.setItem("binary2048.tutorial.v1", '{"version":1,"status":"dismissed"}');
    document.cookie = "binary2048_tutorial_suppress=1; Path=/; SameSite=Lax";
  });

  await page.goto("/");
  const backgroundToggle = page.getByRole("combobox", { name: "Board background" });
  const tileToggle = page.getByRole("combobox", { name: "Tile style" });
  await backgroundToggle.selectOption("cherryBlossom");
  await tileToggle.selectOption("opaque");
  await expect(page.locator("html")).toHaveAttribute("data-board-background", "cherryBlossom");
  await expect(page.locator("html")).toHaveAttribute("data-tile-style", "opaque");

  const board = page.getByRole("grid", { name: "Binary 2048 game board" });
  await expect(board).toHaveCSS("background-image", /board-background\.jpg/);
  const boardBox = await board.boundingBox();
  expect(boardBox).not.toBeNull();
  expect(boardBox?.x).toBeGreaterThanOrEqual(0);
  expect((boardBox?.x ?? 0) + (boardBox?.width ?? 0)).toBeLessThanOrEqual(390);

  await page.getByText("Colors", { exact: true }).click();
  await page.getByLabel("Board color").fill("#334455");
  await page.getByLabel("Opaque tile color").fill("#ffeecc");
  await backgroundToggle.selectOption("default");
  await tileToggle.selectOption("normal");
  await expect(board).toHaveCSS("background-image", "none");
  await expect(board).toHaveCSS("background-color", "rgb(51, 68, 85)");
  await backgroundToggle.selectOption("cherryBlossom");
  await tileToggle.selectOption("opaque");

  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(board.getByRole("gridcell")).toHaveCount(16);
  const emptyTile = board.locator(".cell.empty").first();
  await expect(emptyTile).toBeVisible();
  await expect(emptyTile).toHaveCSS("background-color", "rgb(255, 238, 204)");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-board-background", "cherryBlossom");
  await expect(page.locator("html")).toHaveAttribute("data-tile-style", "opaque");
  await expect.poll(() => page.locator("html").evaluate((element) =>
    element.style.getPropertyValue("--custom-tile-color")
  )).toBe("#ffeecc");
  await expect.poll(() => page.locator("html").evaluate((element) =>
    element.style.getPropertyValue("--custom-board-color")
  )).toBe("#334455");
});

test("keeps special tiles legible on a custom-size floral board", async ({ page }) => {
  const config = {
    width: 5,
    height: 3,
    seed: 27,
    winTile: 2048,
    zeroBehavior: "annihilate",
    spawnOnNoopMove: false,
    spawn: { pZero: 0.15, pOne: 0.72, pWildcard: 0.1, pLock: 0.03, wildcardMultipliers: [2, 4, 8] }
  };
  const grid = [
    [{ t: "n", v: 2048 }, { t: "w", m: 2 }, { t: "z" }, { t: "i" }, null],
    [null, null, null, null, null],
    [null, null, null, null, null]
  ];
  const current = {
    id: "g_cherry_theme",
    config,
    width: 5,
    height: 3,
    seed: 27,
    rngStep: 0,
    score: 0,
    turn: 0,
    won: false,
    over: false,
    grid
  };

  await page.addInitScript(() => {
    window.localStorage.removeItem("binary2048.currentGameId");
    window.localStorage.removeItem("binary2048.resumeSnapshot");
    window.localStorage.setItem("binary2048.tutorial.v1", '{"version":1,"status":"dismissed"}');
    document.cookie = "binary2048_tutorial_suppress=1; Path=/; SameSite=Lax";
  });
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: current.id,
        current,
        recoverySnapshot: { recoveryVersion: 1, rulesetId: "binary2048-v1", config, initialGrid: grid, moves: [] },
        undo: { limit: 2, used: 0, remaining: 2 },
        integrity: { sessionClass: "unranked", source: "created" }
      })
    });
  });

  await page.goto("/");
  await page.getByRole("combobox", { name: "Board background" }).selectOption("cherryBlossom");
  await page.getByRole("combobox", { name: "Tile style" }).selectOption("opaque");
  await page.getByRole("button", { name: "Start New Game" }).click();

  const board = page.getByRole("grid", { name: "Binary 2048 game board" });
  await expect(board.getByRole("gridcell")).toHaveCount(15);
  await expect(board).toHaveAttribute("style", /repeat\(5,/);
  await expect(page.getByRole("gridcell", { name: "row 1 column 1 number 2048" })).toBeVisible();
  await expect(page.getByRole("gridcell", { name: "row 1 column 2 wildcard" })).toBeVisible();
  await expect(page.getByRole("gridcell", { name: "row 1 column 3 zero" })).toBeVisible();
  await expect(page.getByRole("gridcell", { name: "row 1 column 4 lock zero" })).toBeVisible();

  for (const selector of [".tile-number", ".tile-wild", ".tile-zero", ".tile-lock"]) {
    await expect(board.locator(selector).first()).toHaveCSS("background-color", "rgb(255, 253, 248)");
    await expect(board.locator(selector).first()).toHaveCSS("background-image", "none");
  }
});
