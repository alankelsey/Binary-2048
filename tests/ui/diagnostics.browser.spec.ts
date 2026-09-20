import { expect, test } from "@playwright/test";
import { applyMove, createGame, DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameConfig, GameState } from "@/lib/binary2048/types";

test("game log captures moves, export/replay results, console errors, and supports toggle/copy/clear", async ({ page }) => {
  const config: GameConfig = {
    ...DEFAULT_CONFIG,
    seed: 5150,
    spawn: { pZero: 0, pOne: 1, pWildcard: 0, pLock: 0, wildcardMultipliers: [2] }
  };
  const initialGrid: Cell[][] = [
    [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ];
  let current: GameState = createGame(config, initialGrid).state;
  const moves: Dir[] = [];

  await page.addInitScript(() => {
    window.localStorage.removeItem("binary2048.currentGameId");
    window.localStorage.removeItem("binary2048.resumeSnapshot");
    window.localStorage.setItem("binary2048.tutorial.v1", '{"version":1,"status":"dismissed"}');
    document.cookie = "binary2048_tutorial_suppress=1; Path=/; SameSite=Lax";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as typeof window & { __copiedDiagnostic?: string }).__copiedDiagnostic = value;
        }
      }
    });
  });
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    current = createGame(config, initialGrid).state;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: current.id,
        // Present a later client-visible state, then let the mocked move
        // endpoint return its earlier engine state. This recreates the
        // multi-instance rollback symptom the log is intended to expose.
        current: { ...current, turn: 3, score: 10 },
        recoverySnapshot: {
          recoveryVersion: 1,
          rulesetId: "binary2048-v1",
          sessionId: current.id,
          config,
          initialGrid,
          moves: []
        },
        undo: { limit: 2, used: 0, remaining: 2 },
        integrity: { sessionClass: "unranked", source: "created" }
      })
    });
  });
  await page.route("**/api/games/*/move", async (route) => {
    const body = route.request().postDataJSON() as { dir: Dir; recoverySnapshot?: { moves?: Dir[] } };
    expect(body.recoverySnapshot?.moves).toEqual(moves);
    const result = applyMove(current, body.dir);
    current = result.state;
    moves.push(body.dir);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: current.id,
        current,
        lastStep: { moved: result.moved, events: result.events },
        recoverySnapshot: {
          recoveryVersion: 1,
          rulesetId: "binary2048-v1",
          sessionId: current.id,
          config,
          initialGrid,
          moves
        },
        undo: { limit: 2, used: 0, remaining: 2 },
        integrity: { sessionClass: "unranked", source: "created" }
      })
    });
  });
  await page.route("**/api/games/*/export?compact=1", async (route) => {
    const body = route.request().postDataJSON() as { recoverySnapshot?: { moves?: Dir[] } };
    expect(body.recoverySnapshot?.moves).toEqual(moves);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        header: {
          replayVersion: 1,
          rulesetId: "binary2048-v1",
          engineVersion: "test",
          size: 4,
          seed: config.seed,
          createdAt: "2026-09-17T00:00:00.000Z"
        },
        config,
        initialGrid,
        moves
      })
    });
  });
  await page.route("**/api/replay/code?hosted=1", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body.config).toEqual(config);
    expect(body.initialGrid).toEqual(initialGrid);
    expect(body.moves).toEqual(moves);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: "rs1.diagnostic-test", length: 19, hosted: true, overLimit: false })
    });
  });

  await page.goto("/");
  const log = page.getByRole("textbox", { name: "Game diagnostic log" });
  await expect(log).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show Log" })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Show Log" }).click();
  await expect(log).toBeVisible();
  await expect(log).toHaveValue(/diagnostics_ready/);

  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
  await page.keyboard.press("ArrowLeft");
  await expect(log).toHaveValue(/move_request[\s\S]*dir=left/);
  await expect(log).toHaveValue(/move_response[\s\S]*status=200[\s\S]*recoveryMoves=1/);
  await expect(log).toHaveValue(/recovery_snapshot_saved[\s\S]*moves=1/);
  await expect(log).toHaveValue(
    /state_regression_detected[\s\S]*previousTurn=3[\s\S]*nextTurn=1/
  );

  await page.evaluate(() => console.error("diagnostic-test-error token=do-not-copy"));
  await expect(log).toHaveValue(/console_error[\s\S]*diagnostic-test-error/);
  await expect(log).not.toHaveValue(/do-not-copy/);

  await page.getByRole("button", { name: "Copy Replay Link" }).click();
  await expect(log).toHaveValue(/export_response[\s\S]*moves=1[\s\S]*hasConfig=true/);
  await expect(log).toHaveValue(/replay_code_response[\s\S]*status=200/);

  await page.getByRole("button", { name: "Copy Log" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as typeof window & { __copiedDiagnostic?: string }).__copiedDiagnostic ?? ""
      )
    )
    .toContain("move_response");

  await page.getByRole("button", { name: "Hide Log" }).click();
  await expect(log).toHaveCount(0);
  await page.getByRole("button", { name: "Show Log" }).click();
  await expect(log).toBeVisible();
  await page.getByRole("button", { name: "Clear Log" }).click();
  await expect(log).toHaveValue("No diagnostics recorded.");
});
