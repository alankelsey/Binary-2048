import { expect, test } from "@playwright/test";
import { applyMove, DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameState } from "@/lib/binary2048/types";
import { gameStateHash, STATE_HASH_VERSION } from "@/lib/binary2048/state-identity";

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
  const requestBodies: Array<{ expectStateHash?: string; expectStateHashVersion?: string }> = [];

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
    };
    const { dir } = body;
    requests.push(dir);
    requestBodies.push(body);
    await moveGate;
    current = applyMove(current, dir).state;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...createdPayload(current),
        lastStep: { moved: true, events: [] },
        recoverySnapshot: { ...createdPayload(current).recoverySnapshot, moves: requests }
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
    expectStateHashVersion: STATE_HASH_VERSION
  });

  releaseMove();
  await expect.poll(() =>
    page.evaluate(() => performance.getEntriesByName("binary2048:move-complete").length)
  ).toBe(1);
  await expect.poll(() => renderedLabels(page)).toEqual(labels(current));
  const trace = await page.evaluate(() =>
    (performance.getEntriesByName("binary2048:move-complete")[0] as PerformanceMark).detail
  );
  expect(trace.localEngineStatus).toBe("completed");
  expect(trace.localEngineDurationMs).toBeGreaterThanOrEqual(0);
  expect(trace.phases.map((phase: { phase: string }) => phase.phase)).toEqual(
    expect.arrayContaining(["local_engine_start", "local_engine_end", "local_prediction_paint"])
  );
});

test("rolls predicted and queued moves back when the active request fails", async ({ page }) => {
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
  expect(requests).toEqual(["left"]);
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

test("keeps ranked rendering server-authoritative", async ({ page }) => {
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
  expect(await renderedLabels(page)).toEqual(labels(initial));

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
  expect(completeTrace.localEngineStatus).toBe("not_run");
});
