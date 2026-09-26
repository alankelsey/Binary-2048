import { expect, test } from "@playwright/test";
import { DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameState } from "@/lib/binary2048/types";

test("records accepted and queued moves through the next painted frame", async ({ page }) => {
  const initialGrid: Cell[][] = [
    [{ t: "n", v: 1 }, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ];
  let current: GameState = {
    id: "g_performance_trace",
    config: { ...DEFAULT_CONFIG, seed: 8128 },
    width: 4,
    height: 4,
    seed: 8128,
    rngStep: 0,
    score: 0,
    turn: 0,
    won: false,
    over: false,
    grid: initialGrid
  };
  const completedMoves: Dir[] = [];

  await page.addInitScript(() => {
    window.localStorage.removeItem("binary2048.currentGameId");
    window.localStorage.removeItem("binary2048.resumeSnapshot");
    window.localStorage.setItem("binary2048.tutorial.v1", '{"version":1,"status":"dismissed"}');
    document.cookie = "binary2048_tutorial_suppress=1; Path=/; SameSite=Lax";
    performance.clearMarks();
    performance.clearMeasures();
  });
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
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
      })
    });
  });
  await page.route("**/api/games/*/move", async (route) => {
    const body = route.request().postDataJSON() as { dir: Dir };
    await new Promise((resolve) => setTimeout(resolve, 40));
    completedMoves.push(body.dir);
    current = { ...current, turn: completedMoves.length, score: completedMoves.length };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: current.id,
        current,
        lastStep: { moved: true, events: [] },
        recoverySnapshot: {
          recoveryVersion: 1,
          rulesetId: "binary2048-v1",
          sessionId: current.id,
          config: current.config,
          initialGrid,
          moves: completedMoves
        },
        undo: { limit: 2, used: 0, remaining: 2 },
        integrity: { sessionClass: "unranked", source: "created" }
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");

  await expect.poll(() => completedMoves.length).toBe(2);
  await expect.poll(() =>
    page.evaluate(() => performance.getEntriesByName("binary2048:move-complete").length)
  ).toBe(2);
  await page.locator(".board").evaluate((board) => {
    const start = new Touch({ identifier: 1, target: board, clientX: 80, clientY: 80 });
    const end = new Touch({ identifier: 1, target: board, clientX: 160, clientY: 80 });
    board.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [start] }));
    board.dispatchEvent(new TouchEvent("touchend", { bubbles: true, changedTouches: [end] }));
  });
  await expect.poll(() => completedMoves.length).toBe(3);
  await expect.poll(() =>
    page.evaluate(() => performance.getEntriesByName("binary2048:move-complete").length)
  ).toBe(3);

  const traces = await page.evaluate(() =>
    performance.getEntriesByName("binary2048:move-complete").map((entry) =>
      (entry as PerformanceMark).detail as {
        traceId: string;
        direction: string;
        source: string;
        localEngineStatus: string;
        phases: Array<{ phase: string; atMs: number; attempt?: number }>;
      }
    )
  );
  expect(traces.map((trace) => trace.direction)).toEqual(["left", "down", "right"]);
  expect(traces.map((trace) => trace.source)).toEqual(["keyboard", "keyboard", "touch"]);
  expect(traces.every((trace) => trace.localEngineStatus === "not_run")).toBe(true);
  expect(traces[0].phases.map((phase) => phase.phase)).toEqual([
    "input_capture",
    "accepted",
    "local_engine_not_run",
    "request_start",
    "response_headers",
    "response_parse_start",
    "response_parse_end",
    "react_commit",
    "next_animation_frame"
  ]);
  expect(traces[1].phases.map((phase) => phase.phase)).toEqual([
    "input_capture",
    "queued",
    "local_engine_not_run",
    "request_start",
    "response_headers",
    "response_parse_start",
    "response_parse_end",
    "react_commit",
    "next_animation_frame"
  ]);
  expect(traces[2].phases.map((phase) => phase.phase)).toEqual(traces[0].phases.map((phase) => phase.phase));
  for (const trace of traces) {
    expect(trace.phases.every((phase, index) => index === 0 || phase.atMs >= trace.phases[index - 1].atMs)).toBe(true);
    expect(trace.phases.find((phase) => phase.phase === "request_start")?.attempt).toBe(1);
  }
  expect(
    await page.evaluate(() => performance.getEntriesByName("binary2048:move-input-to-next-frame").length)
  ).toBe(3);
});
