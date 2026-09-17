import { expect, test, type Page } from "@playwright/test";
import { applyMove, createGame, DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameConfig, GameState } from "@/lib/binary2048/types";

// Mobile action-dock coverage (docs/mobile-ui-accessibility-audit-2026-09-15.md,
// docs/roadmap-checklist.md "Complete the mobile action-dock accessibility
// follow-up"). Game API responses are mocked with the same page.route +
// engine (applyMove/createGame) convention already used in
// tests/prod/prod.browser.spec.ts and tests/prod/special-tiles.browser.spec.ts,
// so these run fully offline against whatever server `baseURL` points at —
// but they live in tests/ui (run via `npm run test:ui`, see
// playwright.ui.config.ts) rather than tests/prod because they are local
// UI regression tests, not production synthetics: they mock every API
// response, so running them against the live site would tell you nothing
// about production and would risk hitting it with fixture traffic. Default
// baseURL is http://localhost:3000; override with UI_BASE if your dev
// server runs on a different port.

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 412, height: 915 }
] as const;

function mockGameRoutes(page: Page, initialGrid: Cell[][], config: GameConfig) {
  const created = createGame(config, initialGrid).state;
  let current: GameState = created;
  let createRequests = 0;

  return {
    getCurrent: () => current,
    getCreateRequests: () => createRequests,
    async install() {
      await page.addInitScript(() => {
        window.localStorage.removeItem("binary2048.currentGameId");
        window.localStorage.removeItem("binary2048.resumeSnapshot");
      });
      await page.route("**/api/games", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        createRequests += 1;
        current = createGame(config, initialGrid).state;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: current.id,
            current,
            recoverySnapshot: { recoveryVersion: 1, rulesetId: "binary2048-v1", config, initialGrid, moves: [] },
            undo: { limit: 2, used: 0, remaining: 2 },
            integrity: { sessionClass: "unranked", source: "created" }
          })
        });
      });
      await page.route("**/api/games/*/move", async (route) => {
        const body = route.request().postDataJSON() as { dir: Dir };
        const result = applyMove(current, body.dir);
        current = result.state;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: current.id,
            current,
            lastStep: { events: result.events },
            undo: { limit: 2, used: 0, remaining: 2 },
            integrity: { sessionClass: "unranked", source: "created" }
          })
        });
      });
    }
  };
}

function standardConfig(seed: number): GameConfig {
  return {
    ...DEFAULT_CONFIG,
    seed,
    spawn: { pZero: 0, pOne: 1, pWildcard: 0, pLock: 0, wildcardMultipliers: [2] }
  };
}

test.describe("mobile action dock", () => {
  test("shows the Start New Game overlay when no recoverable game exists", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      window.localStorage.removeItem("binary2048.currentGameId");
      window.localStorage.removeItem("binary2048.resumeSnapshot");
    });
    await page.goto("/");
    await expect(page.getByRole("dialog", { name: "NEW GAME" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start New Game" })).toBeVisible();
  });

  test("starting a guest game does not request an authenticated bridge token", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let bridgeRequests = 0;
    await page.route("**/api/auth/bridge-token", async (route) => {
      bridgeRequests += 1;
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: '{"error":"Authenticated session required"}'
      });
    });
    const grid: Cell[][] = [
      [{ t: "n", v: 2 }, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, { t: "n", v: 2 }, null, null]
    ];
    const routes = mockGameRoutes(page, grid, standardConfig(8));
    await routes.install();

    await page.goto("/");
    await expect(page.locator(".auth-shell")).toHaveAttribute("data-authenticated", "false");
    await page.getByRole("button", { name: "Start New Game" }).click();
    await expect(page.getByRole("gridcell", { name: /number 2$/ })).toHaveCount(2);
    expect(bridgeRequests).toBe(0);
  });

  for (const viewport of VIEWPORTS) {
    test(`primary controls stay visible and secondary controls start collapsed at ${viewport.width}x${viewport.height}`, async ({
      page
    }) => {
      await page.setViewportSize(viewport);
      const grid: Cell[][] = [
        [{ t: "n", v: 2 }, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, { t: "n", v: 2 }, null, null]
      ];
      const routes = mockGameRoutes(page, grid, standardConfig(1));
      await routes.install();

      await page.goto("/");
      await page.getByRole("button", { name: "Start New Game" }).click();
      await expect(page.getByRole("gridcell", { name: /number 2$/ })).toHaveCount(2);
      await expect(page.getByRole("button", { name: "New Game", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Undo/ })).toBeVisible();
      const optionsToggle = page.getByRole("button", { name: "Options", exact: true });
      await expect(optionsToggle).toBeVisible();
      await expect(optionsToggle).toHaveAttribute("aria-expanded", "false");

      // Secondary drawer exists in the DOM (for the toggle's aria-controls
      // target) but must not be visible/collapsed by default on mobile.
      const secondary = page.locator("#game-controls-more");
      await expect(secondary).toHaveClass(/mobile-collapsed/);
      await expect(secondary).not.toBeVisible();
    });

    test(`Options opens and closes the secondary controls at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const grid: Cell[][] = [
        [{ t: "n", v: 2 }, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, { t: "n", v: 2 }, null, null]
      ];
      const routes = mockGameRoutes(page, grid, standardConfig(2));
      await routes.install();

      await page.goto("/");
      await page.getByRole("button", { name: "Start New Game" }).click();
      await expect(page.getByRole("gridcell", { name: /number 2$/ })).toHaveCount(2);
      // Locate by the stable class rather than accessible name: the name
      // itself flips between "Options" and "Hide Options" as it toggles.
      const optionsToggle = page.locator(".mobile-controls-toggle");
      const secondary = page.locator("#game-controls-more");

      await optionsToggle.click();
      await expect(optionsToggle).toHaveAttribute("aria-expanded", "true");
      await expect(optionsToggle).toHaveText("Hide Options");
      await expect(secondary).toBeVisible();
      await expect(secondary).not.toHaveClass(/mobile-collapsed/);

      await optionsToggle.click();
      await expect(optionsToggle).toHaveAttribute("aria-expanded", "false");
      await expect(optionsToggle).toHaveText("Options");
      await expect(secondary).not.toBeVisible();
    });

    test(`primary buttons stay in one row, including the "Confirm New Game" label, at ${viewport.width}x${viewport.height}`, async ({
      page
    }) => {
      await page.setViewportSize(viewport);
      const grid: Cell[][] = [
        [{ t: "n", v: 2 }, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, { t: "n", v: 2 }, null, null]
      ];
      const routes = mockGameRoutes(page, grid, standardConfig(3));
      await routes.install();

      await page.goto("/");
      await page.getByRole("button", { name: "Start New Game" }).click();
      await expect(page.getByRole("gridcell", { name: /number 2$/ })).toHaveCount(2);
      await page.keyboard.press("ArrowLeft");
      await expect.poll(() => routes.getCurrent().turn).toBe(1);

      async function assertSingleRow() {
        const tops = await page.locator(".actions-primary > button").evaluateAll((buttons) =>
          buttons.map((b) => Math.round(b.getBoundingClientRect().top))
        );
        expect(tops.length).toBeGreaterThan(0);
        const spread = Math.max(...tops) - Math.min(...tops);
        expect(spread).toBeLessThanOrEqual(1);

        const viewportWidth = page.viewportSize()?.width ?? 0;
        const rects = await page.locator(".actions-primary > button").evaluateAll((buttons) =>
          buttons.map((b) => {
            const r = b.getBoundingClientRect();
            return { left: r.left, right: r.right };
          })
        );
        for (const rect of rects) {
          expect(rect.left).toBeGreaterThanOrEqual(0);
          expect(rect.right).toBeLessThanOrEqual(viewportWidth + 1);
        }
      }

      // Unarmed row: New Game / Undo / (Fullscreen) / Options.
      await assertSingleRow();

      // Arm the confirmation — label becomes "Confirm New Game", the
      // longest string this dock ever renders.
      await page.getByRole("button", { name: "New Game", exact: true }).click();
      await expect(page.getByRole("button", { name: "Confirm New Game", exact: true })).toBeVisible();
      const confirmBox = await page.getByRole("button", { name: "Confirm New Game", exact: true }).boundingBox();
      expect(confirmBox).not.toBeNull();
      // The label must render on a single line (not wrap within the pill),
      // which we can tell from the button height matching the dock's fixed
      // min-height rather than roughly doubling.
      expect(confirmBox!.height).toBeLessThanOrEqual(46);
      await assertSingleRow();
    });
  }

  test("New Game requires a second tap to confirm during an active run, and the first tap does not start a new game", async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const grid: Cell[][] = [
      [{ t: "n", v: 2 }, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, { t: "n", v: 2 }, null, null]
    ];
    const routes = mockGameRoutes(page, grid, standardConfig(4));
    await routes.install();

    await page.goto("/");
    await page.getByRole("button", { name: "Start New Game" }).click();
    await expect(page.getByRole("gridcell", { name: /number 2$/ })).toHaveCount(2);
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => routes.getCurrent().turn).toBe(1);
    expect(routes.getCreateRequests()).toBe(1);
    const gameIdBeforeConfirm = routes.getCurrent().id;

    await page.getByRole("button", { name: "New Game", exact: true }).click();
    await expect(page.getByRole("button", { name: "Confirm New Game", exact: true })).toBeVisible();
    // Arming the guard must not touch the game at all.
    expect(routes.getCreateRequests()).toBe(1);
    expect(routes.getCurrent().id).toBe(gameIdBeforeConfirm);
    expect(routes.getCurrent().turn).toBe(1);

    await page.getByRole("button", { name: "Confirm New Game", exact: true }).click();
    await expect.poll(() => routes.getCreateRequests()).toBe(2);
  });

  test("a failed guest recovery preserves the Normal board instead of silently starting another game", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const config: GameConfig = {
      ...DEFAULT_CONFIG,
      seed: 41,
      spawn: { pZero: 0.15, pOne: 0.72, pWildcard: 0.1, pLock: 0.03, wildcardMultipliers: [2] }
    };
    const grid: Cell[][] = [
      [{ t: "n", v: 2 }, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, { t: "n", v: 2 }, null, null]
    ];
    const current = createGame(config, grid).state;
    let createRequests = 0;
    let moveRecoverySnapshot: unknown;

    await page.addInitScript(() => {
      window.localStorage.removeItem("binary2048.currentGameId");
      window.localStorage.removeItem("binary2048.resumeSnapshot");
      window.localStorage.setItem("binary2048.spawnMode", "normal");
    });
    await page.route("**/api/games", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      createRequests += 1;
      const body = route.request().postDataJSON() as { config?: { spawn?: { pWildcard?: number; pLock?: number } } };
      expect(body.config?.spawn).toMatchObject({ pWildcard: 0.1, pLock: 0.03 });
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
    await page.route("**/api/games/*/move", async (route) => {
      moveRecoverySnapshot = (route.request().postDataJSON() as { recoverySnapshot?: unknown }).recoverySnapshot;
      await route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"Game not found"}' });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start New Game" }).click();
    await expect(page.getByText("Difficulty: Normal")).toBeVisible();
    await expect(page.getByRole("button", { name: "New Game", exact: true })).toBeEnabled();
    await page.keyboard.press("ArrowLeft");

    await expect(page.getByText("Game session could not be recovered. Your board is still saved; reload to retry.")).toBeVisible();
    await expect(page.getByRole("gridcell", { name: /number 2$/ })).toHaveCount(2);
    expect(moveRecoverySnapshot).toBeTruthy();
    expect(createRequests).toBe(1);
  });

  test("mobile export downloads from the recovery-aware endpoint", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const grid: Cell[][] = [
      [{ t: "n", v: 2 }, { t: "n", v: 2 }, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const routes = mockGameRoutes(page, grid, standardConfig(42));
    await routes.install();
    let recoverySnapshot: unknown;
    await page.route("**/api/games/*/export", async (route) => {
      expect(route.request().method()).toBe("POST");
      recoverySnapshot = (route.request().postDataJSON() as { recoverySnapshot?: unknown }).recoverySnapshot;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-disposition": 'attachment; filename="guest-game.json"' },
        body: JSON.stringify({ version: 1, meta: { rulesetId: "binary2048-v1" } })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start New Game" }).click();
    await expect(page.getByRole("button", { name: "New Game", exact: true })).toBeEnabled();
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => routes.getCurrent().turn).toBe(1);
    await page.getByRole("button", { name: "Options", exact: true }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export JSON" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("guest-game.json");
    expect(recoverySnapshot).toBeTruthy();
    await expect(page.getByText("Game export downloaded")).toBeVisible();
  });

  test("replay links remain usable when mobile clipboard permission is unavailable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async () => Promise.reject(new Error("clipboard denied")) }
      });
      document.execCommand = () => false;
    });
    const grid: Cell[][] = [
      [{ t: "n", v: 2 }, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, { t: "n", v: 2 }, null, null]
    ];
    const routes = mockGameRoutes(page, grid, standardConfig(43));
    await routes.install();
    let recoverySnapshot: unknown;
    await page.route("**/api/games/*/export?compact=1", async (route) => {
      recoverySnapshot = (route.request().postDataJSON() as { recoverySnapshot?: unknown }).recoverySnapshot;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ header: { replayVersion: 1, rulesetId: "binary2048-v1" }, moves: [] })
      });
    });
    await page.route("**/api/replay/code?hosted=1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ code: "rs1.mobile-replay", overLimit: false })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start New Game" }).click();
    await page.getByRole("button", { name: "Copy Replay Link" }).click();

    expect(recoverySnapshot).toBeTruthy();
    await expect(page.getByText("Replay link ready—tap Copy Replay Link again")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Replay Link" })).toHaveAttribute(
      "href",
      /\/replay\?code=rs1.mobile-replay$/
    );
  });

  test("the dock does not overlap the board or the final scrollable content", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const grid: Cell[][] = [
      [{ t: "n", v: 2 }, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, { t: "n", v: 2 }, null, null]
    ];
    const routes = mockGameRoutes(page, grid, standardConfig(5));
    await routes.install();

    await page.goto("/");
    await page.getByRole("button", { name: "Start New Game" }).click();

    const dockBox = await page.locator(".actions-primary").boundingBox();
    const boardBox = await page.locator(".board").boundingBox();
    expect(dockBox).not.toBeNull();
    expect(boardBox).not.toBeNull();
    expect(dockBox!.y).toBeGreaterThanOrEqual(boardBox!.y + boardBox!.height);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(50);
    const lastContentBottom = await page.evaluate(() => {
      const el = document.querySelector(".build-version") ?? document.querySelector(".share-row");
      return el ? el.getBoundingClientRect().bottom : 0;
    });
    const dockTopAfterScroll = (await page.locator(".actions-primary").boundingBox())!.y;
    expect(lastContentBottom).toBeLessThanOrEqual(dockTopAfterScroll + 1);
  });

  test("reduced motion shortens cell effect animations", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const grid: Cell[][] = [
      [{ t: "n", v: 2 }, { t: "n", v: 2 }, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const routes = mockGameRoutes(page, grid, standardConfig(6));
    await routes.install();

    await page.goto("/");
    await page.getByRole("button", { name: "Start New Game" }).click();
    await expect(page.getByRole("gridcell", { name: /number 2$/ })).toHaveCount(2);
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => routes.getCurrent().turn).toBe(1);

    const durations = await page.evaluate(() => {
      const cells = [...document.querySelectorAll(".cell")].filter((el) =>
        [...el.classList].some((c) => c.startsWith("fx-"))
      );
      return cells.map((el) => getComputedStyle(el).animationDuration);
    });
    expect(durations.length).toBeGreaterThan(0);
    for (const duration of durations) {
      const seconds = parseFloat(duration);
      expect(seconds).toBeLessThanOrEqual(0.01);
    }
  });

  test("without reduced motion, cell effect animations run at full duration", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const grid: Cell[][] = [
      [{ t: "n", v: 2 }, { t: "n", v: 2 }, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const routes = mockGameRoutes(page, grid, standardConfig(7));
    await routes.install();

    await page.goto("/");
    await page.getByRole("button", { name: "Start New Game" }).click();
    await expect(page.getByRole("gridcell", { name: /number 2$/ })).toHaveCount(2);
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => routes.getCurrent().turn).toBe(1);

    const durations = await page.evaluate(() => {
      const cells = [...document.querySelectorAll(".cell")].filter((el) =>
        [...el.classList].some((c) => c.startsWith("fx-"))
      );
      return cells.map((el) => getComputedStyle(el).animationDuration);
    });
    expect(durations.length).toBeGreaterThan(0);
    expect(durations.some((duration) => parseFloat(duration) > 0.05)).toBe(true);
  });
});
