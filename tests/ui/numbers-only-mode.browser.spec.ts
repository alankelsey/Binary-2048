import { expect, test } from "@playwright/test";
import { createGame } from "@/lib/binary2048/engine";
import { createNumbersOnlyConfig, NUMBERS_ONLY_RULESET_ID } from "@/lib/binary2048/numbers-only";

test("selects, explains, and starts the explicitly unranked numbers-only mode", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("binary2048.currentGameId");
    window.localStorage.removeItem("binary2048.resumeSnapshot");
    window.localStorage.setItem("binary2048.tutorial.v1", '{"version":1,"status":"dismissed"}');
    document.cookie = "binary2048_tutorial_suppress=1; Path=/; SameSite=Lax";
  });
  let requestBody: Record<string, unknown> | null = null;
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    const config = createNumbersOnlyConfig(12_201);
    const current = createGame(config).state;
    const integrity = {
      sessionClass: "unranked",
      source: "created",
      boardOrigin: "canonical",
      gameMode: "numbers-only",
      modeRulesetId: NUMBERS_ONLY_RULESET_ID
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: current.id,
        current,
        steps: [],
        mode: "numbers-only",
        integrity,
        recoverySnapshot: {
          recoveryVersion: 1,
          rulesetId: "binary2048-v1",
          config,
          initialGrid: current.grid,
          moves: [],
          integrity
        },
        undo: { limit: 2, used: 0, remaining: 2 }
      })
    });
  });

  await page.goto("/");
  const mode = page.getByRole("combobox", { name: "Game mode" });
  await mode.selectOption("numbers-only");
  await expect(page.getByRole("combobox", { name: "Difficulty" })).toBeDisabled();
  await expect(page.getByRole("note")).toContainText("no zero, wildcard, or Lock-0 tiles");
  await expect(page.getByRole("note")).toContainText("unranked");
  await page.getByRole("button", { name: "Start New Game" }).click();

  expect(requestBody).toMatchObject({
    mode: "numbers-only",
    config: {
      spawn: { pZero: 0, pOne: 1, pWildcard: 0, pLock: 0, wildcardMultipliers: [2] }
    }
  });
  await expect(page.getByText("Mode: Numbers only")).toBeVisible();
  await expect(page.getByRole("gridcell", { name: /number 1$/ })).toHaveCount(2);

  const summary = page.getByText(/^How to play:/);
  await summary.click();
  await expect(summary.locator("..")).toContainText("Numbers only mode");
});
