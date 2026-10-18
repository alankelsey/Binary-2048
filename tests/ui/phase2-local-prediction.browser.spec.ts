import { expect, test } from "@playwright/test";
import { applyMove, DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameState } from "@/lib/binary2048/types";
import { gameStateHash, STATE_HASH_VERSION } from "@/lib/binary2048/state-identity";
import { COMPACT_SYNC_VERSION } from "@/lib/binary2048/compact-sync";

const initialGrid: Cell[][] = [
  [null, { t: "n", v: 1 }, { t: "n", v: 1 }, null],
  [null, null, null, null],
  [null, null, null, null],
  [null, null, null, null]
];

function initialState(id: string): GameState {
  return {
    id,
    config: { ...DEFAULT_CONFIG, seed: 20261016 },
    width: 4,
    height: 4,
    seed: 20261016,
    rngStep: 0,
    score: 0,
    turn: 0,
    won: false,
    over: false,
    grid: initialGrid
  };
}

function labels(state: GameState) {
  return state.grid.flatMap((row, rowIndex) =>
    row.map((cell, columnIndex) => {
      const tile = !cell
        ? "empty"
        : cell.t === "n"
          ? `number ${cell.v}`
          : cell.t === "z"
            ? "zero"
            : cell.t === "i"
              ? "lock zero"
              : "wildcard";
      return `row ${rowIndex + 1} column ${columnIndex + 1} ${tile}`;
    })
  );
}

function createdPayload(state: GameState) {
  return {
    id: state.id,
    current: state,
    stateHash: gameStateHash(state),
    stateHashVersion: STATE_HASH_VERSION,
    recoverySnapshot: {
      recoveryVersion: 1,
      rulesetId: "binary2048-v1",
      sessionId: state.id,
      config: state.config,
      initialGrid,
      moves: []
    },
    undo: { limit: 2, used: 0, remaining: 2 },
    integrity: { sessionClass: "unranked", source: "created" }
  };
}

async function prepare(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem("binary2048.currentGameId");
    window.localStorage.removeItem("binary2048.resumeSnapshot");
    window.localStorage.setItem("binary2048.tutorial.v1", '{"version":1,"status":"dismissed"}');
    document.cookie = "binary2048_tutorial_suppress=1; Path=/; SameSite=Lax";
    performance.clearMarks();
    performance.clearMeasures();
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/move")) {
        const snapshot = {
          labels: Array.from(document.querySelectorAll('[role="gridcell"]')).map((cell) =>
            cell.getAttribute("aria-label")
          ),
          moves: document.querySelector(".meta")?.textContent ?? ""
        };
        (window as typeof window & { __moveFetchSnapshots?: Array<typeof snapshot> }).__moveFetchSnapshots ??= [];
        (window as typeof window & { __moveFetchSnapshots: Array<typeof snapshot> }).__moveFetchSnapshots.push(snapshot);
      }
      return originalFetch(input, init);
    };
  });
}

async function renderedLabels(page: import("@playwright/test").Page) {
  return page.getByRole("gridcell").evaluateAll((cells) =>
    cells.map((cell) => cell.getAttribute("aria-label"))
  );
}

test("paints a casual prediction before move network I/O and acknowledges it once", async ({ page }) => {
  let current = initialState("g_phase2_prediction");
  let releaseMove!: () => void;
  const moveGate = new Promise<void>((resolve) => {
    releaseMove = resolve;
  });
  const requests: Dir[] = [];
  const requestBodies: Array<{
    expectStateHash?: string;
    expectStateHashVersion?: string;
    expectTurn?: number;
    syncVersion?: string;
    recoverySnapshot?: unknown;
  }> = [];

  await prepare(page);
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(createdPayload(current)) });
  });
  await page.route("**/api/games/*/move", async (route) => {
    const body = route.request().postDataJSON() as {
      dir: Dir;
      expectStateHash?: string;
      expectStateHashVersion?: string;
      expectTurn?: number;
      syncVersion?: string;
      recoverySnapshot?: unknown;
    };
    const { dir } = body;
    requests.push(dir);
    requestBodies.push(body);
    await moveGate;
    current = applyMove(current, dir).state;
    const { recoverySnapshot: _recoverySnapshot, ...compactResponse } = createdPayload(current);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...compactResponse,
        lastStep: { moved: true, events: [] }
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");

  const predicted = applyMove(current, "left").state;
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => requests.length).toBe(1);
  await expect.poll(() => renderedLabels(page)).toEqual(labels(predicted));
  await expect(page.locator(".meta")).toContainText(`Moves: ${predicted.turn}`);
  const fetchSnapshot = await page.evaluate(() =>
    (window as typeof window & { __moveFetchSnapshots?: Array<{ labels: Array<string | null>; moves: string }> })
      .__moveFetchSnapshots?.[0]
  );
  expect(fetchSnapshot?.labels).toEqual(labels(predicted));
  expect(fetchSnapshot?.moves).toContain(`Moves: ${predicted.turn}`);
  expect(requestBodies[0]).toMatchObject({
    expectStateHash: gameStateHash(initialState("g_phase2_prediction")),
    expectStateHashVersion: STATE_HASH_VERSION,
    expectTurn: 0,
    syncVersion: COMPACT_SYNC_VERSION
  });
  expect(requestBodies[0].recoverySnapshot).toBeUndefined();

  releaseMove();
  await expect.poll(() =>
    page.evaluate(() => performance.getEntriesByName("binary2048:move-complete").length)
  ).toBe(1);
  await expect.poll(() => renderedLabels(page)).toEqual(labels(current));
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("binary2048.resumeSnapshot");
    return raw ? JSON.parse(raw) : null;
  })).toMatchObject({
    version: "checkpoint-tail-v1",
    recovery: { acknowledgedTail: ["left"], pendingTail: [] }
  });
  const trace = await page.evaluate(() =>
    (performance.getEntriesByName("binary2048:move-complete")[0] as PerformanceMark).detail
  );
  expect(trace.localEngineStatus).toBe("completed");
  expect(trace.localEngineDurationMs).toBeGreaterThanOrEqual(0);
  expect(trace.phases.map((phase: { phase: string }) => phase.phase)).toEqual(
    expect.arrayContaining(["local_engine_start", "local_engine_end", "local_prediction_paint"])
  );
});

test("sends the signed checkpoint plus acknowledged tail when a compact session is missing", async ({ page }) => {
  let current = initialState("g_phase3_compact_recovery");
  const bodies: Array<{ dir: Dir; compactRecovery?: { acknowledgedTail?: Dir[] }; recoverySnapshot?: unknown }> = [];

  await prepare(page);
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(createdPayload(current)) });
  });
  await page.route("**/api/games/*/move", async (route) => {
    const body = route.request().postDataJSON() as typeof bodies[number];
    bodies.push(body);
    if (bodies.length === 2) {
      await route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"Game not found"}' });
      return;
    }
    current = applyMove(current, body.dir).state;
    const { recoverySnapshot: _recoverySnapshot, ...response } = createdPayload(current);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...response, lastStep: { moved: true, events: [] } })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => bodies.length).toBe(1);
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => bodies.length).toBe(3);

  expect(bodies.map((body) => body.dir)).toEqual(["left", "down", "down"]);
  expect(bodies[2].recoverySnapshot).toBeUndefined();
  expect(bodies[2].compactRecovery).toMatchObject({
    version: "checkpoint-tail-v1",
    acknowledgedTail: ["left"],
    pendingTail: ["down"]
  });
  await expect.poll(() => renderedLabels(page)).toEqual(labels(current));
});

test("rolls predicted and queued moves back after the active request exhausts its retry", async ({ page }) => {
  const initial = initialState("g_phase2_rollback");
  let releaseMove!: () => void;
  const moveGate = new Promise<void>((resolve) => {
    releaseMove = resolve;
  });
  const requests: Dir[] = [];

  await prepare(page);
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(createdPayload(initial)) });
  });
  await page.route("**/api/games/*/move", async (route) => {
    requests.push((route.request().postDataJSON() as { dir: Dir }).dir);
    await moveGate;
    await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"storage unavailable"}' });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  });

  const predicted = applyMove(applyMove(initial, "left").state, "down").state;
  await expect.poll(() => renderedLabels(page)).toEqual(labels(predicted));
  expect(requests).toEqual(["left"]);
  releaseMove();
  await expect(page.getByText("storage unavailable")).toBeVisible();
  await expect.poll(() => renderedLabels(page)).toEqual(labels(initial));
  expect(requests).toEqual(["left", "left"]);
  await expect.poll(() =>
    page.evaluate(() => performance.getEntriesByName("binary2048:move-dropped").length)
  ).toBe(1);
});

test("classifies injected hash divergence and stops the predicted tail", async ({ page }) => {
  const initial = initialState("g_phase2_divergence");
  const canonical = applyMove(initial, "left").state;
  const authoritative = { ...canonical, score: canonical.score + 4 };
  let releaseMove!: () => void;
  const moveGate = new Promise<void>((resolve) => {
    releaseMove = resolve;
  });
  const requests: Dir[] = [];

  await prepare(page);
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(createdPayload(initial)) });
  });
  await page.route("**/api/games/*/move", async (route) => {
    requests.push((route.request().postDataJSON() as { dir: Dir }).dir);
    await moveGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...createdPayload(authoritative),
        lastStep: { moved: true, events: [] }
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  });
  await expect.poll(() => requests).toEqual(["left"]);

  releaseMove();
  await expect(page.getByText("Prediction differed from the server. Continued from the authoritative board.")).toBeVisible();
  await expect.poll(() => renderedLabels(page)).toEqual(labels(authoritative));
  expect(requests).toEqual(["left"]);
  const trace = await page.evaluate(() =>
    (performance.getEntriesByName("binary2048:move-complete")[0] as PerformanceMark).detail
  );
  expect(trace.reconciliationSamples).toEqual([
    expect.objectContaining({ classification: "state_hash_mismatch" })
  ]);
  const dropped = await page.evaluate(() =>
    (performance.getEntriesByName("binary2048:move-dropped")[0] as PerformanceMark).detail
  );
  expect(dropped.dropReason).toBe("buffer_cleared_divergence");
});

test("paints ranked prediction immediately but advances only on authoritative acknowledgement", async ({ page }) => {
  const initial = initialState("g_phase2_ranked");
  const authoritative = applyMove(initial, "left").state;
  let releaseMove!: () => void;
  const moveGate = new Promise<void>((resolve) => {
    releaseMove = resolve;
  });
  let requestStarted = false;

  await prepare(page);
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...createdPayload(initial),
        integrity: { sessionClass: "ranked", source: "created" }
      })
    });
  });
  await page.route("**/api/games/*/move", async (route) => {
    requestStarted = true;
    await moveGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...createdPayload(authoritative),
        lastStep: { moved: true, events: [] },
        integrity: { sessionClass: "ranked", source: "created" }
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => requestStarted).toBe(true);
  expect(await renderedLabels(page)).toEqual(labels(authoritative));

  releaseMove();
  await expect.poll(() => renderedLabels(page)).toEqual(labels(authoritative));
  await expect.poll(() =>
    page.evaluate(() =>
      (performance.getEntriesByName("binary2048:move-complete")[0] as PerformanceMark | undefined)?.detail
    )
  ).not.toBeUndefined();
  const completeTrace = await page.evaluate(() =>
    (performance.getEntriesByName("binary2048:move-complete")[0] as PerformanceMark).detail
  );
  expect(completeTrace.localEngineStatus).toBe("completed");
  expect(completeTrace.reconciliationSamples).toEqual([
    expect.objectContaining({ classification: "match" })
  ]);
});

test("blocks ranked input after authoritative divergence", async ({ page }) => {
  const initial = initialState("g_phase2_ranked_divergence");
  const predicted = applyMove(initial, "left").state;
  const authoritative = { ...predicted, score: predicted.score + 8 };
  let requests = 0;
  await prepare(page);
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...createdPayload(initial),
        integrity: { sessionClass: "ranked", source: "created" }
      })
    });
  });
  await page.route("**/api/games/*/move", async (route) => {
    requests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...createdPayload(authoritative),
        integrity: { sessionClass: "ranked", source: "created" }
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByText(/Ranked prediction could not be verified/)).toBeVisible();
  await expect.poll(() => renderedLabels(page)).toEqual(labels(authoritative));
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  expect(requests).toBe(1);
  await expect(page.getByText(/must be reloaded or replaced/)).toBeVisible();
  const dropped = await page.evaluate(() =>
    (performance.getEntriesByName("binary2048:move-dropped")[0] as PerformanceMark).detail
  );
  expect(dropped.dropReason).toBe("prediction_blocked");
});

test("rejects ranked moves while offline without painting or requesting", async ({ page }) => {
  const initial = initialState("g_phase2_ranked_offline");
  let requests = 0;
  await prepare(page);
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...createdPayload(initial),
        integrity: { sessionClass: "ranked", source: "created" }
      })
    });
  });
  await page.route("**/api/games/*/move", async (route) => {
    requests += 1;
    await route.fulfill({ status: 500, body: "unexpected" });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
  await page.context().setOffline(true);
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByText("Ranked moves require a connection. Reconnect before continuing.")).toBeVisible();
  expect(requests).toBe(0);
  expect(await renderedLabels(page)).toEqual(labels(initial));
  const dropped = await page.evaluate(() =>
    (performance.getEntriesByName("binary2048:move-dropped")[0] as PerformanceMark).detail
  );
  expect(dropped.dropReason).toBe("ranked_offline");
  await page.context().setOffline(false);
});

test("retries a recoverable failure once and preserves the predicted board", async ({ page }) => {
  const initial = initialState("g_phase2_retry");
  const authoritative = applyMove(initial, "left").state;
  let attempts = 0;
  await prepare(page);
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(createdPayload(initial)) });
  });
  await page.route("**/api/games/*/move", async (route) => {
    attempts += 1;
    await route.fulfill(attempts === 1
      ? { status: 503, contentType: "application/json", body: '{"error":"temporary"}' }
      : { status: 200, contentType: "application/json", body: JSON.stringify(createdPayload(authoritative)) });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => attempts).toBe(2);
  await expect.poll(() => renderedLabels(page)).toEqual(labels(authoritative));
  await expect(page.getByText("Connection interrupted. Retrying this move once…")).toHaveCount(0);
});

test("turns a retry conflict into a duplicate acknowledgement without a second move", async ({ page }) => {
  const initial = initialState("g_phase2_duplicate_ack");
  const authoritative = applyMove(initial, "left").state;
  let moveAttempts = 0;
  let reads = 0;
  await prepare(page);
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(createdPayload(initial)) });
  });
  await page.route("**/api/games/*/move", async (route) => {
    moveAttempts += 1;
    await route.fulfill(moveAttempts === 1
      ? { status: 503, contentType: "application/json", body: '{"error":"response lost"}' }
      : { status: 409, contentType: "application/json", body: '{"error":"stale precondition"}' });
  });
  await page.route("**/api/games/g_phase2_duplicate_ack", async (route) => {
    reads += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(createdPayload(authoritative)) });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => moveAttempts).toBe(2);
  await expect.poll(() => reads).toBe(1);
  await expect.poll(() => renderedLabels(page)).toEqual(labels(authoritative));
  await expect(page.locator(".meta")).toContainText(`Moves: ${authoritative.turn}`);
  await expect(page.locator(".status-error")).toHaveCount(0);
});

test("keeps a bounded in-memory prediction while offline and resumes in FIFO order", async ({ page }) => {
  const initial = initialState("g_phase2_offline");
  let current = initial;
  const requests: Dir[] = [];
  await prepare(page);
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(createdPayload(initial)) });
  });
  await page.route("**/api/games/*/move", async (route) => {
    const dir = (route.request().postDataJSON() as { dir: Dir }).dir;
    requests.push(dir);
    current = applyMove(current, dir).state;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(createdPayload(current)) });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
  await page.context().setOffline(true);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  });
  await expect(page.getByText(/Offline\. Your moves are queued/)).toBeVisible();
  expect(requests).toEqual([]);
  await page.context().setOffline(false);
  await expect.poll(() => requests).toEqual(["left", "down"]);
  await expect.poll(() => renderedLabels(page)).toEqual(labels(current));
});
