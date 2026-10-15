import { expect, test } from "@playwright/test";
import { DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameState } from "@/lib/binary2048/types";

test.use({ hasTouch: true, viewport: { width: 412, height: 915 } });

test("orders a real browser touch burst and classifies queue saturation", async ({ page }) => {
  const initialGrid: Cell[][] = [
    [{ t: "n", v: 1 }, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ];
  let current: GameState = {
    id: "g_rapid_swipe",
    config: { ...DEFAULT_CONFIG, seed: 2048 },
    width: 4,
    height: 4,
    seed: 2048,
    rngStep: 0,
    score: 0,
    turn: 0,
    won: false,
    over: false,
    grid: initialGrid
  };
  const requestedMoves: Dir[] = [];
  let activeRequests = 0;
  let maxActiveRequests = 0;
  let releaseFirstResponse = () => {};
  const firstResponseGate = new Promise<void>((resolve) => {
    releaseFirstResponse = resolve;
  });

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
        undo: { limit: 2, used: 0, remaining: 2 },
        integrity: { sessionClass: "unranked", source: "created" }
      })
    });
  });
  await page.route("**/api/games/*/move", async (route) => {
    const body = route.request().postDataJSON() as { dir: Dir };
    const requestIndex = requestedMoves.length;
    requestedMoves.push(body.dir);
    activeRequests += 1;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    if (requestIndex === 0) await firstResponseGate;
    current = { ...current, turn: requestIndex + 1, score: requestIndex + 1 };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: current.id,
        current,
        lastStep: { moved: true, events: [] },
        undo: { limit: 2, used: 0, remaining: 2 },
        integrity: { sessionClass: "unranked", source: "created" }
      })
    });
    activeRequests -= 1;
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");

  const board = page.locator(".board");
  const box = await board.boundingBox();
  if (!box) throw new Error("Board bounding box was not available");
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const distance = Math.min(72, box.width / 4);
  const directions: Dir[] = ["left", "down", "right", "up", "left", "down", "right", "up", "left", "down"];
  const client = await page.context().newCDPSession(page);

  for (const [index, direction] of directions.entries()) {
    const delta = {
      left: { x: -distance, y: 0 },
      right: { x: distance, y: 0 },
      up: { x: 0, y: -distance },
      down: { x: 0, y: distance }
    }[direction];
    const id = index + 1;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...center, id }]
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: center.x + delta.x, y: center.y + delta.y, id }]
    });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }

  await expect.poll(() => page.evaluate(() =>
    performance.getEntriesByName("binary2048:move-dropped").length
  )).toBe(1);
  releaseFirstResponse();

  const acceptedDirections = directions.slice(0, 9);
  await expect.poll(() => requestedMoves.length, { timeout: 10_000 }).toBe(acceptedDirections.length);
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
  expect(requestedMoves).toEqual(acceptedDirections);
  expect(maxActiveRequests).toBe(1);

  const result = await page.evaluate(() => ({
    completed: performance.getEntriesByName("binary2048:move-complete").map((entry) => {
      const detail = (entry as PerformanceMark).detail;
      return {
        direction: detail.direction,
        source: detail.source,
        queueDepths: detail.queueDepthSamples.map((sample: { stage: string; depth: number }) => ({
          stage: sample.stage,
          depth: sample.depth
        }))
      };
    }),
    dropped: (performance.getEntriesByName("binary2048:move-dropped")[0] as PerformanceMark).detail
  }));
  expect(result.completed).toHaveLength(9);
  expect(result.completed.map((entry) => entry.direction)).toEqual(acceptedDirections);
  expect(result.completed.every((entry) => entry.source === "touch")).toBe(true);
  expect(result.completed[0].queueDepths).toEqual([{ stage: "capture", depth: 0 }]);
  expect(result.completed.slice(1).every((entry) =>
    entry.queueDepths.some((sample: { stage: string; depth: number }) => sample.stage === "enqueue") &&
    entry.queueDepths.some((sample: { stage: string; depth: number }) => sample.stage === "dequeue")
  )).toBe(true);
  expect(result.dropped).toMatchObject({
    direction: "down",
    source: "touch",
    outcome: "dropped",
    dropReason: "queue_full",
    queueDepthSamples: [
      { stage: "capture", depth: 8 },
      { stage: "drop", depth: 8 }
    ]
  });
});
