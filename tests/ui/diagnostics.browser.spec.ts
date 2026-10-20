import { expect, test } from "@playwright/test";
import { applyMove, createGame, DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameConfig, GameState } from "@/lib/binary2048/types";

const gameLogEnabled = process.env.NEXT_PUBLIC_GAME_LOG_ENABLED === "1";

function recoveryMoves(body: {
  recoverySnapshot?: { moves?: Dir[] };
  compactRecovery?: { checkpoint?: { moves?: Dir[] }; acknowledgedTail?: Dir[] };
}) {
  return body.recoverySnapshot?.moves ?? [
    ...(body.compactRecovery?.checkpoint?.moves ?? []),
    ...(body.compactRecovery?.acknowledgedTail ?? [])
  ];
}

test("support mode is off by default while critical diagnostics remain available", async ({ page }) => {
  test.skip(gameLogEnabled, "Runs only against the normal app configuration");
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Game diagnostics" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable Support Mode" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show Log" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy Log" })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Game diagnostic log" })).toHaveCount(0);
  await page.evaluate(() => console.error("disabled-game-log-probe"));
  await page.getByRole("button", { name: "Enable Support Mode" }).click();
  await page.getByRole("button", { name: "Show Log" }).click();
  const log = page.getByRole("textbox", { name: "Game diagnostic log" });
  await expect(log).toHaveValue(/console_error[\s\S]*disabled-game-log-probe/);
  await expect(log).not.toHaveValue(/diagnostics_ready/);
});

test("game log captures moves, export/replay results, console errors, and supports toggle/copy/clear", async ({ page }) => {
  test.skip(!gameLogEnabled, "Requires NEXT_PUBLIC_GAME_LOG_ENABLED=1");
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
    const body = route.request().postDataJSON() as {
      dir: Dir;
      recoverySnapshot?: { moves?: Dir[] };
      compactRecovery?: { checkpoint?: { moves?: Dir[] }; acknowledgedTail?: Dir[] };
    };
    expect(recoveryMoves(body)).toEqual(moves);
    const result = applyMove(current, body.dir);
    current = result.state;
    moves.push(body.dir);
    await new Promise((resolve) => setTimeout(resolve, 800));
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
    const body = route.request().postDataJSON() as {
      recoverySnapshot?: { moves?: Dir[] };
      compactRecovery?: { checkpoint?: { moves?: Dir[] }; acknowledgedTail?: Dir[] };
    };
    expect(recoveryMoves(body)).toEqual([]);
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
  await page.getByRole("button", { name: "Enable Support Mode" }).click();
  const log = page.getByRole("textbox", { name: "Game diagnostic log" });
  await expect(log).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show Log" })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Show Log" }).click();
  await expect(log).toBeVisible();
  await expect(log).toHaveValue(/support_mode_enabled/);

  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: "Confirm New Game" }).click();
  await expect(page.getByRole("dialog", { name: "NEW GAME" })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await expect(log).toHaveValue(/input_drop_counts[\s\S]*modal_open=2[\s\S]*total=2/);
  await page.keyboard.press("Escape");
  await page.keyboard.press("ArrowLeft");
  await expect(log).toHaveValue(/move_request[\s\S]*dir=left/);
  await expect(log).toHaveValue(/move_response[\s\S]*status=200[\s\S]*recoveryMoves=1/);
  await expect(log).not.toHaveValue(new RegExp(current.id));
  await expect(log).toHaveValue(/slow_acknowledgement[\s\S]*durationMs=/);
  await expect(log).toHaveValue(/prediction_reconciliation[\s\S]*classification=unsupported_hash_version/);
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

test("support mode persists across reload, disables immediately, and removes expired state", async ({ page }) => {
  test.skip(!gameLogEnabled, "Requires NEXT_PUBLIC_GAME_LOG_ENABLED=1");
  await page.goto("/");
  await page.getByRole("button", { name: "Enable Support Mode" }).click();
  await expect(page.getByRole("button", { name: "Disable Support Mode" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("binary2048.supportMode.v1"))).not.toBeNull();

  await page.reload();
  await expect(page.getByRole("button", { name: "Disable Support Mode" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Game diagnostics" }).getByRole("status"))
    .toContainText("Detailed success tracing is on.");
  await page.getByRole("button", { name: "Disable Support Mode" }).click();
  await expect(page.getByRole("button", { name: "Enable Support Mode" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show Log" })).toHaveCount(0);
  expect(await page.evaluate(() => window.localStorage.getItem("binary2048.supportMode.v1"))).toBeNull();

  await page.evaluate(() => window.localStorage.setItem(
    "binary2048.supportMode.v1",
    JSON.stringify({ version: 1, expiresAt: Date.now() - 1 })
  ));
  await page.reload();
  await expect(page.getByRole("button", { name: "Enable Support Mode" })).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("binary2048.supportMode.v1"))).toBeNull();
});
