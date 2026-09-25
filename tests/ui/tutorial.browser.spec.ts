import { expect, test, type Page } from "@playwright/test";
import { createGame, DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import { TUTORIAL_LESSONS, TUTORIAL_SUCCESS_DURATION_MS } from "@/lib/binary2048/tutorial";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

const keyForDirection = { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown" } as const;
const normalGameConfig: GameConfig = {
  ...DEFAULT_CONFIG,
  seed: 8128,
  spawn: { pZero: 0, pOne: 1, pWildcard: 0, pLock: 0, wildcardMultipliers: [2] }
};

async function mockNormalGame(page: Page, onCreate?: () => void) {
  const initialGrid: Cell[][] = [
    [{ t: "n", v: 2 }, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, { t: "n", v: 2 }, null, null]
  ];
  const current = createGame(normalGameConfig, initialGrid).state;
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    onCreate?.();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: current.id,
        current,
        recoverySnapshot: { recoveryVersion: 1, rulesetId: "binary2048-v1", config: normalGameConfig, initialGrid, moves: [] },
        undo: { limit: 2, used: 0, remaining: 2 },
        integrity: { sessionClass: "unranked", source: "created" }
      })
    });
  });
}

async function mockTerminalGame(page: Page, terminal: "over" | "won") {
  const initialGrid: Cell[][] = [
    [{ t: "n", v: terminal === "won" ? 2048 : 2 }, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ];
  const current = {
    ...createGame(normalGameConfig, initialGrid).state,
    over: terminal === "over",
    won: terminal === "won",
    score: terminal === "won" ? 2048 : 64
  };
  await page.addInitScript(() => {
    window.localStorage.removeItem("binary2048.currentGameId");
    window.localStorage.removeItem("binary2048.resumeSnapshot");
    document.cookie = "binary2048_tutorial_suppress=1; Path=/; SameSite=Lax";
  });
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: current.id,
        current,
        recoverySnapshot: { recoveryVersion: 1, rulesetId: "binary2048-v1", config: normalGameConfig, initialGrid, moves: [] },
        undo: { limit: 2, used: 0, remaining: 2 },
        integrity: { sessionClass: "unranked", source: "created" }
      })
    });
  });
}

test("new game offers tutorial without hiding entry points and persists guest opt-out", async ({ page, context }) => {
  let createRequests = 0;
  await context.clearCookies();
  await mockNormalGame(page, () => { createRequests += 1; });
  await page.goto("/");
  const empty = page.getByRole("dialog", { name: "NEW GAME" });
  await expect(empty).toBeVisible();
  await expect(empty.getByRole("button", { name: "Start New Game" })).toBeVisible();
  await expect(empty.getByRole("button", { name: "Play tutorial" })).toBeVisible();
  await expect(empty.getByRole("button", { name: "Options", exact: true })).toHaveCount(0);
  await expect(empty.getByLabel("New game choices")).toBeVisible();
  await expect(empty.getByLabel("Difficulty", { exact: true })).toBeVisible();
  await expect(empty.getByLabel("Game mode")).toBeVisible();
  await expect(empty.getByRole("checkbox", { name: "Offer tutorial before new games" })).toBeChecked();
  await empty.getByRole("button", { name: "Start New Game" }).click();
  const offer = page.getByRole("dialog", { name: "PLAY THE TUTORIAL?" });
  await expect(offer).toBeVisible();
  expect(createRequests).toBe(0);
  await offer.getByRole("checkbox", { name: "Don't offer this before new games" }).check();
  await expect.poll(async () => (await context.cookies()).some((cookie) => cookie.name === "binary2048_tutorial_suppress")).toBe(true);
  await offer.getByRole("button", { name: "Back" }).click();
  await empty.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.getByRole("grid", { name: "Binary 2048 game board" })).toBeVisible();
  expect(createRequests).toBe(1);
  await page.evaluate(() => {
    window.localStorage.removeItem("binary2048.currentGameId");
    window.localStorage.removeItem("binary2048.resumeSnapshot");
  });
  await page.reload();
  await expect(page.getByRole("dialog", { name: "NEW GAME" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play tutorial" })).toBeVisible();
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.getByRole("dialog", { name: "PLAY THE TUTORIAL?" })).toHaveCount(0);
  expect(createRequests).toBe(2);
});

test("guided tutorial automatically advances through every lesson without gameplay APIs", async ({ page }) => {
  let gameplayRequests = 0;
  await page.route("**/api/games**", async (route) => {
    gameplayRequests += 1;
    await route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Play tutorial" }).click();
  const firstBoard = await page.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")));
  await page.keyboard.press("ArrowLeft");
  expect(await page.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")))).toEqual(firstBoard);
  for (let lessonIndex = 0; lessonIndex < TUTORIAL_LESSONS.length; lessonIndex += 1) {
    const lesson = TUTORIAL_LESSONS[lessonIndex];
    for (let moveIndex = 0; moveIndex < lesson.expectedMoves.length; moveIndex += 1) {
      const coach = page.getByRole("dialog", { name: lesson.title });
      await expect(coach).toBeVisible();
      await expect(coach.locator(".tutorial-swipe-arrow")).toHaveAttribute("data-direction", lesson.expectedMoves[moveIndex]);
      await coach.getByRole("button", { name: "Try it" }).click();
      if (lessonIndex === 0 && moveIndex === 0) {
        await page.keyboard.press("ArrowRight");
        await expect(page.locator(".tutorial-feedback-float")).toHaveText("Try left.");
        expect(await page.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")))).toEqual(firstBoard);
      }
      await page.keyboard.press(keyForDirection[lesson.expectedMoves[moveIndex]]);
      if (lessonIndex === TUTORIAL_LESSONS.length - 1) break;
      await expect(page.locator(".tutorial-success")).toContainText("Good job!");
    }
  }
  await expect(page.getByRole("gridcell", { name: /number 2048$/ })).toHaveCount(1);
  await expect(page.getByRole("dialog", { name: "You made 2048!" })).toContainText("Lock-0 blocks once");
  await expect(page.getByRole("button", { name: "Next lesson" })).toHaveCount(0);
  await page.getByRole("button", { name: "Start playing" }).click();
  await expect(page.getByRole("dialog", { name: "NEW GAME" })).toBeVisible();
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.getByRole("dialog", { name: "PLAY THE TUTORIAL?" })).toBeVisible();
  expect(gameplayRequests).toBe(0);
});

for (const viewport of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 412, height: 915 }]) {
  test(`tutorial coach and board fit the mobile viewport at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button", { name: "Play tutorial" }).click();
    const board = await page.getByRole("grid", { name: "Binary 2048 tutorial board" }).boundingBox();
    const coach = await page.getByRole("dialog", { name: TUTORIAL_LESSONS[0].title }).boundingBox();
    expect(board).not.toBeNull();
    expect(coach).not.toBeNull();
    expect(board!.y + board!.height).toBeLessThanOrEqual(viewport.height);
    expect(coach!.y + coach!.height).toBeLessThanOrEqual(viewport.height);
    const targets = await page.getByRole("dialog", { name: TUTORIAL_LESSONS[0].title }).getByRole("button").evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().height)
    );
    expect(targets.every((height) => height >= 44)).toBe(true);
  });
}

test("direction cue becomes static when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Play tutorial" }).click();
  await expect(page.locator(".tutorial-swipe-arrow")).toHaveCSS("animation-name", "none");
});

test("tap-to-try accepts a real tutorial swipe gesture", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play tutorial" }).click();
  await page.getByRole("button", { name: "Try it" }).click();
  await page.getByRole("grid", { name: "Binary 2048 tutorial board" }).evaluate((board) => {
    const start = new Touch({ identifier: 1, target: board, clientX: 260, clientY: 240 });
    const end = new Touch({ identifier: 1, target: board, clientX: 120, clientY: 240 });
    board.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [start] }));
    board.dispatchEvent(new TouchEvent("touchend", { bubbles: true, changedTouches: [end] }));
  });
  await expect(page.locator(".tutorial-success")).toContainText("Good job!");
});

test("successful-step feedback remains visible for more than 1.2 seconds", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play tutorial" }).click();
  await page.getByRole("button", { name: "Try it" }).click();
  await page.keyboard.press("ArrowLeft");
  const success = page.locator(".tutorial-success");
  await expect(success).toContainText("Good job!");
  await page.waitForTimeout(1_200);
  await expect(success).toBeVisible();
  await expect(page.getByRole("dialog", { name: TUTORIAL_LESSONS[1].title })).toBeVisible();
});

test("tutorial success auto-advance pauses while the page is hidden", async ({ page }) => {
  await page.addInitScript(() => {
    let visibilityState: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibilityState
    });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => visibilityState === "hidden"
    });
    (window as typeof window & { setTestVisibilityState: (state: DocumentVisibilityState) => void }).setTestVisibilityState = (state) => {
      visibilityState = state;
      document.dispatchEvent(new Event("visibilitychange"));
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Play tutorial" }).click();
  await page.getByRole("button", { name: "Try it" }).click();
  await page.keyboard.press("ArrowLeft");
  const success = page.locator(".tutorial-success");
  await expect(success).toContainText("Good job!");

  await page.evaluate(() => {
    (window as typeof window & { setTestVisibilityState: (state: DocumentVisibilityState) => void }).setTestVisibilityState("hidden");
  });
  await page.waitForTimeout(TUTORIAL_SUCCESS_DURATION_MS + 200);
  await expect(success).toBeVisible();
  await expect(page.getByRole("dialog", { name: TUTORIAL_LESSONS[1].title })).toHaveCount(0);

  await page.evaluate(() => {
    (window as typeof window & { setTestVisibilityState: (state: DocumentVisibilityState) => void }).setTestVisibilityState("visible");
  });
  await expect(page.getByRole("dialog", { name: TUTORIAL_LESSONS[1].title })).toBeVisible();
});

test("refresh restarts the current lesson and quit returns to empty state", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play tutorial" }).click();
  await page.getByRole("button", { name: "Try it" }).click();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("dialog", { name: TUTORIAL_LESSONS[1].title })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog", { name: TUTORIAL_LESSONS[1].title })).toBeVisible();
  await page.getByRole("button", { name: "Try it" }).click();
  const quitTutorial = page.getByRole("button", { name: "Quit tutorial" });
  await quitTutorial.click();
  const exitDialog = page.getByRole("dialog", { name: "EXIT TUTORIAL?" });
  await expect(exitDialog).toBeVisible();
  await expect(exitDialog.getByRole("button", { name: "Keep learning" })).toBeFocused();
  await exitDialog.getByRole("button", { name: "Keep learning" }).press("Tab");
  await expect(exitDialog.getByRole("button", { name: "Leave tutorial" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(exitDialog).toHaveCount(0);
  await expect(quitTutorial).toBeFocused();
  await quitTutorial.click();
  await page.getByRole("button", { name: "Leave tutorial" }).click();
  await expect(page.getByRole("dialog", { name: "NEW GAME" })).toBeVisible();
});

test("launching from an active game is gated and cancellation preserves the board", async ({ page }) => {
  await page.context().addCookies([{ name: "binary2048_tutorial_suppress", value: "1", url: "http://localhost:3000" }]);
  await page.addInitScript(() => {
    window.localStorage.removeItem("binary2048.currentGameId");
    window.localStorage.removeItem("binary2048.resumeSnapshot");
  });
  await mockNormalGame(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.getByRole("gridcell", { name: /number 2$/ })).toHaveCount(2);
  const boardBefore = await page.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")));
  const tutorialButton = page.getByRole("button", { name: "Tutorial", exact: true });
  await tutorialButton.click();
  const launchDialog = page.getByRole("dialog", { name: "END CURRENT GAME?" });
  await expect(launchDialog).toBeVisible();
  await expect(launchDialog.getByRole("button", { name: "Keep playing" })).toBeFocused();
  await launchDialog.getByRole("button", { name: "Keep playing" }).press("Tab");
  await expect(launchDialog.getByRole("button", { name: "End game and start tutorial" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(tutorialButton).toBeFocused();
  expect(await page.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")))).toEqual(boardBefore);
  await tutorialButton.click();
  await page.getByRole("button", { name: "End game and start tutorial" }).click();
  await expect(page.getByRole("grid", { name: "Binary 2048 tutorial board" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("binary2048.currentGameId"))).toBeNull();
});

test("new-game tutorial offer does not interrupt an active guest game until confirmed", async ({ page, context }) => {
  let createRequests = 0;
  await context.clearCookies();
  await page.addInitScript(() => {
    window.localStorage.removeItem("binary2048.currentGameId");
    window.localStorage.removeItem("binary2048.resumeSnapshot");
  });
  await mockNormalGame(page, () => { createRequests += 1; });
  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await page.getByRole("dialog", { name: "PLAY THE TUTORIAL?" }).getByRole("button", { name: "Start game" }).click();
  await expect(page.getByRole("gridcell", { name: /number 2$/ })).toHaveCount(2);
  const boardBefore = await page.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")));
  const gameIdBefore = await page.evaluate(() => window.localStorage.getItem("binary2048.currentGameId"));
  expect(createRequests).toBe(1);

  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("dialog", { name: "NEW GAME" }).getByRole("button", { name: "Start New Game" }).click();
  await expect(page.getByRole("dialog", { name: "PLAY THE TUTORIAL?" })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  expect(await page.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")))).toEqual(boardBefore);
  expect(await page.evaluate(() => window.localStorage.getItem("binary2048.currentGameId"))).toBe(gameIdBefore);
  expect(createRequests).toBe(1);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "PLAY THE TUTORIAL?" })).toHaveCount(0);
  expect(await page.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")))).toEqual(boardBefore);
});

test("a restored guest game honors the tutorial opt-out cookie", async ({ page, context }) => {
  let createRequests = 0;
  const initialGrid: Cell[][] = [
    [{ t: "n", v: 2 }, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, { t: "n", v: 2 }, null, null]
  ];
  const current = createGame(normalGameConfig, initialGrid).state;
  await context.addCookies([{ name: "binary2048_tutorial_suppress", value: "1", url: "http://localhost:3000" }]);
  await page.addInitScript((gameId) => {
    window.localStorage.setItem("binary2048.currentGameId", gameId);
    window.localStorage.removeItem("binary2048.resumeSnapshot");
  }, current.id);
  await page.route(`**/api/games/${current.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: current.id, current, undo: { limit: 2, used: 0, remaining: 2 } })
    });
  });
  await page.route("**/api/games", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    createRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: current.id, current, undo: { limit: 2, used: 0, remaining: 2 } })
    });
  });

  await page.goto("/");
  await expect(page.getByRole("gridcell", { name: /number 2$/ })).toHaveCount(2);
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("dialog", { name: "NEW GAME" }).getByRole("button", { name: "Start New Game" }).click();
  await expect(page.getByRole("dialog", { name: "PLAY THE TUTORIAL?" })).toHaveCount(0);
  await expect.poll(() => createRequests).toBe(1);
});

for (const terminal of ["over", "won"] as const) {
  test(`${terminal} overlay routes New Game to inline choices and keeps Tutorial`, async ({ page }) => {
    await mockTerminalGame(page, terminal);
    await page.goto("/");
    await page.getByRole("button", { name: "Start New Game" }).click();
    const name = terminal === "over" ? "GAME OVER" : "YOU WIN";
    const dialog = page.getByRole("dialog", { name });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "New Game" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Tutorial" })).toBeVisible();
    const replayJson = dialog.getByRole("button", { name: "Replay JSON" });
    await expect(replayJson).toBeVisible();
    await replayJson.focus();
    const fileChooser = page.waitForEvent("filechooser");
    await replayJson.press("Enter");
    const chooser = await fileChooser;
    const replayState = createGame(normalGameConfig, [
      [{ t: "n", v: 2 }, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, { t: "n", v: 2 }, null, null]
    ]).state;
    await chooser.setFiles({
      name: "terminal-replay.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ initial: replayState, steps: [], final: replayState }))
    });
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Game: Replay (terminal-replay.json)")).toBeVisible();
    await expect(page.getByText("Replay step 0/0")).toBeVisible();
    await page.getByRole("button", { name: "Exit Replay" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Options" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "New Game" }).click();
    await expect(dialog).toHaveCount(0);
    const setup = page.getByRole("dialog", { name: "NEW GAME" });
    await expect(setup.getByLabel("New game choices")).toBeVisible();
    await expect(setup.getByRole("button", { name: "Options" })).toHaveCount(0);
    await setup.getByRole("button", { name: "Back" }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Tutorial" }).click();
    await expect(page.getByRole("dialog", { name: "END CURRENT GAME?" })).toHaveCount(0);
    await expect(page.getByRole("grid", { name: "Binary 2048 tutorial board" })).toBeVisible();
  });
}
