import { expect, test, type Page } from "@playwright/test";
import { applyMove, createGame, DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameConfig, GameState } from "@/lib/binary2048/types";

// Difficulty-help disclosure coverage (docs/mobile-ui-accessibility-audit-2026-09-15.md
// finding #6, docs/roadmap-checklist.md "Replace the title-only difficulty
// help with a keyboard- and touch-accessible visible disclosure"). Local UI
// regression suite — see tests/ui/mobile-dock.browser.spec.ts for the same
// page.route + engine mocking convention and why this lives in tests/ui
// (run via `npm run test:ui`, playwright.ui.config.ts) rather than
// tests/prod.
//
// The difficulty select + help button only render inside the Options
// `<details>` panel, which is swapped out for Export/Replay buttons once a
// run is active (lib/binary2048/control-visibility.ts: showOptionsPanel is
// `!isActiveRun`, and a run becomes "active" the moment turn > 0) — so
// these tests never make a move after starting the game.

function mockGameRoutes(page: Page, initialGrid: Cell[][], config: GameConfig) {
  const created = createGame(config, initialGrid).state;
  let current: GameState = created;

  return {
    async install() {
      await page.addInitScript(() => {
    window.localStorage.removeItem("binary2048.currentGameId");
    window.localStorage.removeItem("binary2048.resumeSnapshot");
    window.localStorage.setItem("binary2048.tutorial.v1", '{"version":1,"status":"dismissed"}');
      });
      await page.route("**/api/games", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
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

async function openDifficultyOptions(page: Page) {
  const grid: Cell[][] = [
    [{ t: "n", v: 2 }, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, { t: "n", v: 2 }, null, null]
  ];
  const routes = mockGameRoutes(page, grid, standardConfig(1));
  await routes.install();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.getByRole("gridcell", { name: /number 2$/ })).toHaveCount(2);

  const secondaryToggle = page.locator(".mobile-controls-toggle");
  await secondaryToggle.click();
  await expect(secondaryToggle).toHaveAttribute("aria-expanded", "true");
  const secondary = page.locator("#game-controls-more");
  await expect(secondary).toBeVisible();

  const optionsSummary = page.locator(".options-panel summary").first();
  await optionsSummary.click();
}

test.describe("difficulty help disclosure", () => {
  test("Options opens the secondary controls, revealing the difficulty select and help button", async ({ page }) => {
    await openDifficultyOptions(page);
    await expect(page.locator("#difficulty-select")).toBeVisible();
    await expect(page.getByRole("button", { name: "Show difficulty help" })).toBeVisible();
  });

  test("the help button is keyboard focusable and Enter opens the note, updating aria-expanded", async ({ page }) => {
    await openDifficultyOptions(page);
    // Locate by the stable class rather than the accessible name: the name
    // itself flips between "Show difficulty help" and "Hide difficulty
    // help" as it toggles, same convention as the mobile dock's Options
    // toggle in mobile-dock.browser.spec.ts.
    await expect(page.getByRole("button", { name: "Show difficulty help" })).toBeVisible();
    const helpButton = page.locator(".field-help");

    await helpButton.focus();
    await expect(helpButton).toBeFocused();
    await expect(helpButton).toHaveAttribute("aria-expanded", "false");

    await page.keyboard.press("Enter");
    await expect(helpButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "Hide difficulty help" })).toBeVisible();
  });

  test("Space also opens the note while the button is focused", async ({ page }) => {
    await openDifficultyOptions(page);
    const helpButton = page.locator(".field-help");

    await helpButton.focus();
    await page.keyboard.press("Space");
    await expect(helpButton).toHaveAttribute("aria-expanded", "true");
  });

  test("clicking the help button opens visible help text associated through aria-controls, and the accessible name flips", async ({
    page
  }) => {
    await openDifficultyOptions(page);
    const helpButton = page.locator(".field-help");

    await helpButton.click();
    await expect(helpButton).toHaveAttribute("aria-expanded", "true");

    const controlsId = await helpButton.getAttribute("aria-controls");
    expect(controlsId).toBe("difficulty-help-note");

    const note = page.locator(`#${controlsId}`);
    await expect(note).toBeVisible();
    await expect(note).toHaveAttribute("role", "note");
    await expect(note).toContainText(/Difficulty changes wildcard\/lock spawn rates/);

    await expect(page.getByRole("button", { name: "Hide difficulty help" })).toBeVisible();
  });

  test("Escape closes the note and returns aria-expanded to false", async ({ page }) => {
    await openDifficultyOptions(page);
    const helpButton = page.locator(".field-help");

    await helpButton.click();
    await expect(helpButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#difficulty-help-note")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(helpButton).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#difficulty-help-note")).toHaveCount(0);
  });

  test("tapping the help button opens the note (touch support)", async ({ page }) => {
    await openDifficultyOptions(page);
    const helpButton = page.locator(".field-help");

    await helpButton.dispatchEvent("click");
    await expect(helpButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#difficulty-help-note")).toBeVisible();
  });

  test("the difficulty select has an explicit label association and is not nested inside the help button's label", async ({
    page
  }) => {
    await openDifficultyOptions(page);
    const select = page.locator("#difficulty-select");
    const labelledBy = await select.getAttribute("aria-labelledby");
    expect(labelledBy).toBe("difficulty-select-label");
    await expect(page.locator(`#${labelledBy}`)).toHaveText("Difficulty");

    // The help button must not be a descendant of a <label> that also wraps
    // the select (that would make clicking the button forward activation to
    // the select) — it should be a plain sibling.
    const helpInLabel = await page.locator("label:has(.field-help)").count();
    expect(helpInLabel).toBe(0);
  });
});
