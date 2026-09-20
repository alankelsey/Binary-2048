import { expect, test, type Page } from "@playwright/test";
import { runScenario } from "@/lib/binary2048/engine";
import type { Cell, GameConfig, SessionRecoverySnapshot } from "@/lib/binary2048/types";

const config: GameConfig = {
  width: 4,
  height: 4,
  seed: 2046874478,
  winTile: 2048,
  zeroBehavior: "annihilate",
  spawnOnNoopMove: false,
  spawn: {
    pZero: 0.15,
    pOne: 0.73,
    pWildcard: 0.04,
    pLock: 0.08,
    wildcardMultipliers: [2]
  }
};

const initialGrid: Cell[][] = [
  [null, null, null, null],
  [null, null, null, null],
  [null, null, null, { t: "n", v: 1 }],
  [{ t: "i" }, null, null, null]
];

const moves = ["left", "down", "right", "up", "up", "down", "up"] as const;

async function emulateAuthenticatedShell(page: Page) {
  await page.addInitScript(() => {
    const markAuthenticated = () => {
      const shell = document.querySelector<HTMLElement>(".auth-shell");
      if (shell) shell.dataset.authenticated = "true";
    };
    new MutationObserver(markAuthenticated).observe(document, { childList: true, subtree: true });
    markAuthenticated();
  });
}

function fullExportFile() {
  return {
    name: "realistic-full-export.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(runScenario(config, initialGrid, [...moves])))
  };
}

test("authenticated browser converts a realistic full export before importing", async ({ page }) => {
  await emulateAuthenticatedShell(page);
  let received: SessionRecoverySnapshot | null = null;

  await page.route("**/api/games/import", async (route) => {
    received = route.request().postDataJSON() as SessionRecoverySnapshot;
    const replayed = runScenario(config, initialGrid, [...moves]);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: replayed.final.id,
        current: replayed.final,
        recoverySnapshot: received,
        steps: replayed.steps,
        undo: { limit: 0, used: 0, remaining: 0 },
        integrity: { sessionClass: "unranked", source: "imported" }
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await expect(page.locator('button:has-text("Import JSON")')).toHaveCount(1);
  await page.getByTestId("import-json-input").setInputFiles(fullExportFile());

  await expect.poll(() => received).not.toBeNull();
  expect(received).toEqual({
    recoveryVersion: 1,
    rulesetId: "binary2048-v1",
    config,
    initialGrid,
    moves: [...moves]
  });
  expect(received).not.toHaveProperty("steps");
  expect(received).not.toHaveProperty("version");
  await expect(page.locator(".meta span", { hasText: "Moves: 7" })).toBeVisible();
});

test("shows a specific message when CloudFront or WAF blocks import", async ({ page }) => {
  await emulateAuthenticatedShell(page);
  await page.route("**/api/games/import", async (route) => {
    await route.fulfill({
      status: 403,
      contentType: "text/html",
      body: "<html><body>Request blocked.</body></html>"
    });
  });

  await page.goto("/");
  await page.getByTestId("import-json-input").setInputFiles(fullExportFile());

  await expect(page.locator(".status-error")).toContainText(
    "Import was blocked by site security (HTTP 403)."
  );
});
