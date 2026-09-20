import { expect, test } from "@playwright/test";
import { applyMove, createGame, DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameConfig, GameState } from "@/lib/binary2048/types";

function cellName(cell: Cell): string {
  if (!cell) return "empty";
  if (cell.t === "n") return `number ${cell.v}`;
  if (cell.t === "z") return "zero";
  if (cell.t === "i") return "lock zero";
  return "wildcard";
}

function renderedCellNames(state: GameState): string[] {
  return state.grid.flatMap((row, r) =>
    row.map((cell, c) => `row ${r + 1} column ${c + 1} ${cellName(cell)}`)
  );
}

function numericMax(state: GameState): number {
  return Math.max(
    0,
    ...state.grid.flatMap((row) => row.map((cell) => (cell?.t === "n" ? cell.v : 0)))
  );
}

function planTerminalGame(config: GameConfig, initialGrid: Cell[][]): Dir[] {
  let state = createGame(config, initialGrid).state;
  const moves: Dir[] = [];

  const apply = (dir: Dir) => {
    const result = applyMove(state, dir);
    state = result.state;
    moves.push(dir);
    return result.moved;
  };

  for (let cycle = 0; cycle < 250 && !state.over && !state.won; cycle += 1) {
    const movedLeft = apply("left");
    if (state.over || state.won) break;
    const movedDown = apply("down");
    if (state.over || state.won) break;
    if (!movedLeft && !movedDown) {
      apply("right");
      if (state.over || state.won) break;
      apply("left");
    }
  }

  expect(state.over || state.won).toBe(true);
  return moves;
}

test("a real guest game renders moving and increasing tiles until game over or win", async ({ page, request }) => {
  test.setTimeout(120_000);
  const config: GameConfig = {
    ...DEFAULT_CONFIG,
    seed: 7105,
    spawn: {
      pZero: 0,
      pOne: 1,
      pWildcard: 0,
      pLock: 0,
      wildcardMultipliers: [2]
    }
  };
  const initialGrid: Cell[][] = [
    [{ t: "n", v: 1024 }, { t: "n", v: 1024 }, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ];
  const plannedMoves = planTerminalGame(config, initialGrid);

  const createResponse = await request.post("/api/games", {
    data: { config, initialGrid, mode: "classic" }
  });
  expect(createResponse.status()).toBe(200);
  const created = (await createResponse.json()) as {
    id: string;
    current: GameState;
    recoverySnapshot: unknown;
  };
  expect(created.recoverySnapshot).toBeTruthy();

  await page.addInitScript(
    ({ id, recoverySnapshot }) => {
      window.localStorage.setItem("binary2048.currentGameId", id);
      window.localStorage.setItem(
        "binary2048.resumeSnapshot",
        JSON.stringify({ gameId: id, savedAtISO: new Date().toISOString(), exported: recoverySnapshot })
      );
      window.localStorage.setItem("binary2048.spawnMode", "death");
      window.localStorage.setItem("binary2048.gameMode", "classic");
    },
    { id: created.id, recoverySnapshot: created.recoverySnapshot }
  );

  await page.goto("/");
  await expect(page.getByText("Difficulty: Death by AI")).toBeVisible();
  await expect(page.getByText("Mode: Classic")).toBeVisible();
  const gameLabel = page.locator(".meta span").filter({ hasText: /^Game: / }).first();
  await expect(gameLabel).not.toHaveText("Game: -");
  const activeGameId = (await gameLabel.textContent())?.replace(/^Game: /, "") ?? "";
  expect(activeGameId).toMatch(/^g_/);

  let previousState = created.current;
  let previousScore = 0;
  const initialMax = numericMax(created.current);
  let highestRenderedNumber = initialMax;
  let observedMovingBoard = false;
  let terminalState: GameState | null = null;
  const observedBoards = new Set([renderedCellNames(previousState).join("|")]);

  for (const dir of plannedMoves) {
    const beforeNames = renderedCellNames(previousState);
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === "POST" && /\/api\/games\/[^/]+\/move$/.test(response.url())
    );
    const key = { left: "ArrowLeft", down: "ArrowDown", right: "ArrowRight", up: "ArrowUp" }[dir];
    await page.keyboard.press(key);
    const moveResponse = await responsePromise;
    expect(moveResponse.status()).toBe(200);
    const moved = (await moveResponse.json()) as {
      id: string;
      current: GameState;
      lastStep?: { moved?: boolean };
    };

    expect(moved.id).toBe(activeGameId);
    expect(moved.current.score).toBeGreaterThanOrEqual(previousScore);
    const nextNames = renderedCellNames(moved.current);
    if (moved.lastStep?.moved && nextNames.join("|") !== beforeNames.join("|")) {
      observedMovingBoard = true;
    }
    observedBoards.add(nextNames.join("|"));
    highestRenderedNumber = Math.max(highestRenderedNumber, numericMax(moved.current));

    await expect
      .poll(async () => page.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label"))))
      .toEqual(nextNames);
    await expect(page.locator(".score-pill")).toHaveText(`Score: ${moved.current.score}`);
    await expect(page.locator(".meta span").filter({ hasText: /^Moves: / })).toHaveText(`Moves: ${moved.current.turn}`);
    await expect(gameLabel).toHaveText(`Game: ${activeGameId}`);

    previousState = moved.current;
    previousScore = moved.current.score;
    if (moved.current.over || moved.current.won) {
      terminalState = moved.current;
      break;
    }
  }

  expect(observedMovingBoard).toBe(true);
  expect(observedBoards.size).toBeGreaterThan(1);
  expect(highestRenderedNumber).toBeGreaterThan(initialMax);
  expect(previousScore).toBeGreaterThan(0);
  expect(terminalState).not.toBeNull();
  expect(terminalState!.over || terminalState!.won).toBe(true);
  await expect(page.locator(".meta span").filter({ hasText: /^(Game Over|Won)$/ })).toBeVisible();
  if (terminalState!.over) {
    await expect(page.getByRole("dialog", { name: "GAME OVER" })).toBeVisible();
  } else {
    await expect(page.getByRole("dialog", { name: "YOU WIN" })).toBeVisible();
  }
});
