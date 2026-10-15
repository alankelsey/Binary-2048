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
  const difficulty = page.getByLabel("Difficulty", { exact: true });
  await difficulty.focus();
  await page.keyboard.press("ArrowDown");
  expect(await page.evaluate(() => performance.getEntriesByName("binary2048:move-dropped").length)).toBe(0);
  await difficulty.blur();
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

test("routes rapid keyboard, touch, and controls through one ordered queue", async ({ page }) => {
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
  const requestBodies: string[] = [];
  const responseBodies: string[] = [];

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
    requestBodies.push(route.request().postData() ?? "");
    await new Promise((resolve) => setTimeout(resolve, 150));
    completedMoves.push(body.dir);
    current = { ...current, turn: completedMoves.length, score: completedMoves.length };
    const responseBody = JSON.stringify({
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
    });
    responseBodies.push(responseBody);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: responseBody
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
  for (const name of ["Move up", "Move left", "Move down", "Move right"]) {
    const control = page.getByRole("button", { name });
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  const rapidMoves: Array<{ source: "keyboard" | "touch" | "control"; direction: Dir; key?: string }> = [
    { source: "keyboard", key: "ArrowLeft", direction: "left" },
    { source: "touch", direction: "down" },
    { source: "control", direction: "left" },
    { source: "keyboard", key: "ArrowDown", direction: "down" },
    { source: "touch", direction: "right" },
    { source: "control", direction: "left" },
    { source: "keyboard", key: "ArrowUp", direction: "up" },
    { source: "touch", direction: "right" },
    { source: "control", direction: "down" },
    { source: "touch", direction: "up" }
  ];
  await page.evaluate((moves) => {
    const board = document.querySelector<HTMLElement>(".board");
    if (!board) throw new Error("Board was not found");
    for (const move of moves) {
      if (move.source === "keyboard") {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: move.key, bubbles: true, cancelable: true }));
        continue;
      }
      if (move.source === "control") {
        document.querySelector<HTMLButtonElement>(`[data-direction="${move.direction}"]`)?.click();
        continue;
      }
      const start = new Touch({ identifier: 1, target: board, clientX: 100, clientY: 100 });
      const endPoint = {
        left: [40, 100], right: [160, 100], up: [100, 40], down: [100, 160]
      }[move.direction];
      const end = new Touch({ identifier: 1, target: board, clientX: endPoint[0], clientY: endPoint[1] });
      board.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [start] }));
      board.dispatchEvent(new TouchEvent("touchend", { bubbles: true, changedTouches: [end] }));
    }
  }, rapidMoves);

  const acceptedRapidMoves = rapidMoves.slice(0, 9);
  await expect.poll(() => completedMoves.length, { timeout: 10_000 }).toBe(acceptedRapidMoves.length);
  expect(completedMoves).toEqual(acceptedRapidMoves.map((move) => move.direction));
  await expect.poll(() =>
    page.evaluate(() => performance.getEntriesByName("binary2048:move-complete").length)
  ).toBe(acceptedRapidMoves.length);
  await expect.poll(() =>
    page.evaluate(() => performance.getEntriesByName("binary2048:move-dropped").length)
  ).toBe(1);
  const traces = await page.evaluate(() =>
    performance.getEntriesByName("binary2048:move-complete").map((entry) =>
      (entry as PerformanceMark).detail as {
        traceId: string;
        direction: string;
        source: string;
        localEngineStatus: string;
        outcome: string;
        queueDepthSamples: Array<{ stage: string; depth: number; atMs: number }>;
        payloadSamples: Array<{
          attempt: number;
          requestBytes: number;
          responseBytes: number;
          requestRecoveryHistoryLength: number;
          responseRecoveryHistoryLength: number | null;
        }>;
        localStorageSamples: Array<{ operation: string; durationMs: number; attempt: number }>;
        checkpointSamples: Array<{ durationMs: number; recoveryHistoryLength: number }>;
        phases: Array<{ phase: string; atMs: number; attempt?: number }>;
      }
    )
  );
  expect(traces.map((trace) => trace.direction)).toEqual([
    ...acceptedRapidMoves.map((move) => move.direction)
  ]);
  expect(traces.map((trace) => trace.source)).toEqual([
    ...acceptedRapidMoves.map((move) => move.source)
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
  for (const trace of traces) {
    expect(trace.phases.every((phase, index) => index === 0 || phase.atMs >= trace.phases[index - 1].atMs)).toBe(true);
    expect(trace.phases.find((phase) => phase.phase === "request_start")?.attempt).toBe(1);
  }
  expect(traces.map((trace) => trace.payloadSamples[0])).toEqual(
    requestBodies.map((requestBody, index) => ({
      attempt: 1,
      requestBytes: Buffer.byteLength(requestBody, "utf8"),
      responseBytes: Buffer.byteLength(responseBodies[index], "utf8"),
      requestRecoveryHistoryLength: index,
      responseRecoveryHistoryLength: index + 1
    }))
  );
  for (const [index, trace] of traces.entries()) {
    expect(trace.localStorageSamples).toHaveLength(2);
    expect(trace.localStorageSamples.map((sample) => sample.operation)).toEqual(["read", "write"]);
    expect(trace.localStorageSamples.every((sample) => sample.attempt === 1 && sample.durationMs >= 0)).toBe(true);
    expect(trace.checkpointSamples).toEqual([
      expect.objectContaining({ recoveryHistoryLength: index + 1 })
    ]);
    expect(trace.checkpointSamples[0].durationMs).toBeGreaterThanOrEqual(0);
  }
  expect(
    await page.evaluate(() => performance.getEntriesByName("binary2048:move-input-to-next-frame").length)
  ).toBe(acceptedRapidMoves.length);
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
    source: rapidMoves.at(-1)?.source,
    outcome: "dropped",
    dropReason: "queue_full",
    queueDepthSamples: [
      { stage: "capture", depth: 8 },
      { stage: "drop", depth: 8 }
    ],
    phases: [{ phase: "input_capture" }, { phase: "dropped" }]
  });
});

for (const scenario of [
  { name: "terminal response", status: 200, dropReason: "buffer_cleared_terminal_state" },
  { name: "failed response", status: 500, dropReason: "buffer_cleared_move_error" }
] as const) {
  test(`clears queued commands after a ${scenario.name}`, async ({ page }) => {
    const initialGrid: Cell[][] = [
      [{ t: "n", v: 1 }, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const initial: GameState = {
      id: `g_queue_clear_${scenario.status}`,
      config: { ...DEFAULT_CONFIG, seed: scenario.status },
      width: 4,
      height: 4,
      seed: scenario.status,
      rngStep: 0,
      score: 0,
      turn: 0,
      won: false,
      over: false,
      grid: initialGrid
    };
    let moveRequests = 0;

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
          id: initial.id,
          current: initial,
          undo: { limit: 2, used: 0, remaining: 2 },
          integrity: { sessionClass: "unranked", source: "created" }
        })
      });
    });
    await page.route("**/api/games/*/move", async (route) => {
      moveRequests += 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (scenario.status === 500) {
        await route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"move failed"}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: initial.id,
          current: { ...initial, turn: 1, over: true },
          lastStep: { moved: true, events: [] },
          undo: { limit: 2, used: 0, remaining: 2 },
          integrity: { sessionClass: "unranked", source: "created" }
        })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start New Game" }).click();
    await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
    await page.evaluate(() => {
      for (const key of ["ArrowLeft", "ArrowDown", "ArrowRight"]) {
        window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      }
    });

    await expect.poll(() =>
      page.evaluate(() => performance.getEntriesByName("binary2048:move-dropped").length)
    ).toBe(2);
    expect(moveRequests).toBe(1);
    const reasons = await page.evaluate(() =>
      performance.getEntriesByName("binary2048:move-dropped").map((entry) =>
        (entry as PerformanceMark).detail.dropReason as string
      )
    );
    expect(reasons).toEqual([scenario.dropReason, scenario.dropReason]);
  });
}
