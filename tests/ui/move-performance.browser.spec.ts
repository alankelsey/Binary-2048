import { expect, test } from "@playwright/test";
import { DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameState } from "@/lib/binary2048/types";

test("classifies a directional input when no playable game is available", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("binary2048.currentGameId");
    window.localStorage.removeItem("binary2048.resumeSnapshot");
    window.localStorage.setItem("binary2048.tutorial.v1", '{"version":1,"status":"dismissed"}');
    document.cookie = "binary2048_tutorial_suppress=1; Path=/; SameSite=Lax";
    performance.clearMarks();
    performance.clearMeasures();
  });

  await page.goto("/");
  await page.keyboard.press("ArrowLeft");

  await expect.poll(() =>
    page.evaluate(() => performance.getEntriesByName("binary2048:move-dropped").length)
  ).toBe(1);
  const detail = await page.evaluate(() =>
    (performance.getEntriesByName("binary2048:move-dropped")[0] as PerformanceMark).detail
  );
  expect(detail).toMatchObject({
    direction: "left",
    source: "keyboard",
    outcome: "dropped",
    dropReason: "game_unavailable",
    queueDepthSamples: [
      { stage: "capture", depth: 0 },
      { stage: "drop", depth: 0 }
    ]
  });
});

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
    await new Promise((resolve) => setTimeout(resolve, 150));
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
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
  const rapidMoves: Array<{ key: string; direction: Dir }> = [
    { key: "ArrowLeft", direction: "left" },
    { key: "ArrowDown", direction: "down" },
    { key: "ArrowLeft", direction: "left" },
    { key: "ArrowDown", direction: "down" },
    { key: "ArrowRight", direction: "right" },
    { key: "ArrowLeft", direction: "left" },
    { key: "ArrowUp", direction: "up" },
    { key: "ArrowRight", direction: "right" },
    { key: "ArrowDown", direction: "down" },
    { key: "ArrowUp", direction: "up" }
  ];
  for (const move of rapidMoves) await page.keyboard.press(move.key);

  const acceptedRapidMoves = rapidMoves.slice(0, 9);
  await expect.poll(() => completedMoves.length, { timeout: 10_000 }).toBe(acceptedRapidMoves.length);
  expect(completedMoves).toEqual(acceptedRapidMoves.map((move) => move.direction));
  await expect.poll(() =>
    page.evaluate(() => performance.getEntriesByName("binary2048:move-complete").length)
  ).toBe(acceptedRapidMoves.length);
  await expect.poll(() =>
    page.evaluate(() => performance.getEntriesByName("binary2048:move-dropped").length)
  ).toBe(1);
  await page.locator(".board").evaluate((board) => {
    const start = new Touch({ identifier: 1, target: board, clientX: 80, clientY: 80 });
    const end = new Touch({ identifier: 1, target: board, clientX: 160, clientY: 80 });
    board.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [start] }));
    board.dispatchEvent(new TouchEvent("touchend", { bubbles: true, changedTouches: [end] }));
  });
  await expect.poll(() => completedMoves.length).toBe(acceptedRapidMoves.length + 1);
  await expect.poll(() =>
    page.evaluate(() => performance.getEntriesByName("binary2048:move-complete").length)
  ).toBe(acceptedRapidMoves.length + 1);

  const traces = await page.evaluate(() =>
    performance.getEntriesByName("binary2048:move-complete").map((entry) =>
      (entry as PerformanceMark).detail as {
        traceId: string;
        direction: string;
        source: string;
        localEngineStatus: string;
        outcome: string;
        queueDepthSamples: Array<{ stage: string; depth: number; atMs: number }>;
        phases: Array<{ phase: string; atMs: number; attempt?: number }>;
      }
    )
  );
  expect(traces.map((trace) => trace.direction)).toEqual([
    ...acceptedRapidMoves.map((move) => move.direction),
    "right"
  ]);
  expect(traces.map((trace) => trace.source)).toEqual([
    ...acceptedRapidMoves.map(() => "keyboard"),
    "touch"
  ]);
  expect(traces.every((trace) => trace.localEngineStatus === "not_run")).toBe(true);
  expect(traces.every((trace) => trace.outcome === "completed")).toBe(true);
  expect(traces[0].queueDepthSamples).toMatchObject([{ stage: "capture", depth: 0 }]);
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
  const queuedPhases = [
    "input_capture",
    "queued",
    "local_engine_not_run",
    "request_start",
    "response_headers",
    "response_parse_start",
    "response_parse_end",
    "react_commit",
    "next_animation_frame"
  ];
  for (const [index, trace] of traces.slice(1, acceptedRapidMoves.length).entries()) {
    expect(trace.phases.map((phase) => phase.phase)).toEqual(queuedPhases);
    expect(trace.queueDepthSamples).toMatchObject([
      { stage: "capture", depth: index },
      { stage: "enqueue", depth: index + 1 },
      { stage: "dequeue", depth: acceptedRapidMoves.length - index - 2 }
    ]);
  }
  expect(traces.at(-1)?.phases.map((phase) => phase.phase)).toEqual(
    traces[0].phases.map((phase) => phase.phase)
  );
  for (const trace of traces) {
    expect(trace.phases.every((phase, index) => index === 0 || phase.atMs >= trace.phases[index - 1].atMs)).toBe(true);
    expect(trace.phases.find((phase) => phase.phase === "request_start")?.attempt).toBe(1);
  }
  expect(
    await page.evaluate(() => performance.getEntriesByName("binary2048:move-input-to-next-frame").length)
  ).toBe(acceptedRapidMoves.length + 1);
  const dropped = await page.evaluate(() =>
    (performance.getEntriesByName("binary2048:move-dropped")[0] as PerformanceMark).detail as {
      direction: string;
      source: string;
      outcome: string;
      dropReason: string;
      queueDepthSamples: Array<{ stage: string; depth: number }>;
      phases: Array<{ phase: string }>;
    }
  );
  expect(dropped).toMatchObject({
    direction: rapidMoves.at(-1)?.direction,
    source: "keyboard",
    outcome: "dropped",
    dropReason: "queue_full",
    queueDepthSamples: [
      { stage: "capture", depth: 8 },
      { stage: "drop", depth: 8 }
    ],
    phases: [{ phase: "input_capture" }, { phase: "dropped" }]
  });
});
