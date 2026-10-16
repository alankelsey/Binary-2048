import { expect, test, type Page } from "@playwright/test";
import { applyMove, DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameState } from "@/lib/binary2048/types";
import { gameStateHash, STATE_HASH_VERSION } from "@/lib/binary2048/state-identity";

type GestureStep = {
  type: "touchstart" | "touchmove" | "touchend" | "touchcancel";
  touches: number[];
  changed: number[];
  endX?: number;
};

async function dispatchGesture(page: Page, steps: GestureStep[]) {
  await page.locator(".board").evaluate((board, gestureSteps) => {
    const makeTouch = (identifier: number, endX = 100) =>
      new Touch({ identifier, target: board, clientX: endX, clientY: 100 });
    for (const step of gestureSteps) {
      board.dispatchEvent(new TouchEvent(step.type, {
        bubbles: true,
        cancelable: true,
        touches: step.touches.map((identifier) => makeTouch(identifier)),
        changedTouches: step.changed.map((identifier) => makeTouch(identifier, step.endX ?? 100))
      }));
    }
  }, steps);
}

test("invalidates cancelled, stale, mismatched, and multi-touch gestures", async ({ page }) => {
  const initialGrid: Cell[][] = [
    [{ t: "n", v: 1 }, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ];
  let current: GameState = {
    id: "g_touch_state",
    config: { ...DEFAULT_CONFIG, seed: 144 },
    width: 4,
    height: 4,
    seed: 144,
    rngStep: 0,
    score: 0,
    turn: 0,
    won: false,
    over: false,
    grid: initialGrid
  };
  const moves: Dir[] = [];

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
    moves.push(body.dir);
    current = applyMove(current, body.dir).state;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: current.id,
        current,
        stateHash: gameStateHash(current),
        stateHashVersion: STATE_HASH_VERSION,
        lastStep: { moved: true, events: [] },
        undo: { limit: 2, used: 0, remaining: 2 },
        integrity: { sessionClass: "unranked", source: "created" }
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");

  const validSwipe = async (identifier: number, expectedRequests: number) => {
    await dispatchGesture(page, [
      { type: "touchstart", touches: [identifier], changed: [identifier] },
      { type: "touchend", touches: [], changed: [identifier], endX: 40 }
    ]);
    await expect.poll(() => moves.length).toBe(expectedRequests);
    await expect(page.locator(".card")).toHaveAttribute("aria-busy", "false");
  };
  const expectNoNewInput = async (expectedRequests: number) => {
    await page.waitForTimeout(50);
    expect(moves).toHaveLength(expectedRequests);
    const classified = await page.evaluate(() =>
      performance.getEntriesByName("binary2048:move-complete").length +
      performance.getEntriesByName("binary2048:move-dropped").length
    );
    expect(classified).toBe(expectedRequests);
  };

  await validSwipe(1, 1);

  await dispatchGesture(page, [
    { type: "touchstart", touches: [2], changed: [2] },
    { type: "touchcancel", touches: [], changed: [2] },
    { type: "touchend", touches: [], changed: [2], endX: 20 }
  ]);
  await expectNoNewInput(1);
  await validSwipe(3, 2);

  await dispatchGesture(page, [
    { type: "touchstart", touches: [4], changed: [4] },
    { type: "touchend", touches: [], changed: [4], endX: 90 },
    { type: "touchend", touches: [], changed: [4], endX: 20 }
  ]);
  await expectNoNewInput(2);
  await validSwipe(5, 3);

  await dispatchGesture(page, [
    { type: "touchstart", touches: [6], changed: [6] },
    { type: "touchend", touches: [6], changed: [7], endX: 20 },
    { type: "touchend", touches: [], changed: [6], endX: 20 }
  ]);
  await expectNoNewInput(3);
  await validSwipe(8, 4);

  await dispatchGesture(page, [
    { type: "touchstart", touches: [9, 10], changed: [9, 10] },
    { type: "touchend", touches: [10], changed: [9], endX: 20 },
    { type: "touchend", touches: [], changed: [10], endX: 20 }
  ]);
  await expectNoNewInput(4);
  await validSwipe(11, 5);

  await dispatchGesture(page, [
    { type: "touchstart", touches: [12], changed: [12] },
    { type: "touchstart", touches: [12, 13], changed: [13] },
    { type: "touchend", touches: [12], changed: [13], endX: 20 },
    { type: "touchend", touches: [], changed: [12], endX: 20 }
  ]);
  await expectNoNewInput(5);
  await validSwipe(14, 6);

  expect(moves).toEqual(["left", "left", "left", "left", "left", "left"]);
  expect(await page.evaluate(() => performance.getEntriesByName("binary2048:move-dropped").length)).toBe(0);
});
