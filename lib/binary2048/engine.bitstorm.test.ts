import { DEFAULT_CONFIG, createGame, generateBitstormInitialGrid } from "@/lib/binary2048/engine";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

function countFilled(grid: Cell[][]): number {
  return grid.flat().filter((cell) => cell !== null).length;
}

describe("bitstorm seeded grid", () => {
  const config: GameConfig = {
    ...DEFAULT_CONFIG,
    width: 4,
    height: 4,
    seed: 101
  };

  it("generates deterministic seeded starter grids", () => {
    const a = generateBitstormInitialGrid(config);
    const b = generateBitstormInitialGrid(config);
    expect(a).toEqual(b);
  });

  it("leaves at least one empty cell and includes starter tiles", () => {
    const grid = generateBitstormInitialGrid(config);
    const filled = countFilled(grid);
    const total = config.width * config.height;

    expect(filled).toBeGreaterThanOrEqual(4);
    expect(filled).toBeLessThan(total);
  });

  it("can create a valid game from a bitstorm grid", () => {
    const initialGrid = generateBitstormInitialGrid(config);
    const { state } = createGame(config, initialGrid);
    expect(state.grid).toEqual(initialGrid);
    expect(state.turn).toBe(0);
  });

  it("supports broader number tile starts while excluding 2048", () => {
    const seenNumbers = new Set<number>();

    for (let seed = 1; seed <= 120; seed++) {
      const grid = generateBitstormInitialGrid({ ...config, seed });
      for (const cell of grid.flat()) {
        if (cell && cell.t === "n") {
          seenNumbers.add(cell.v);
          expect(cell.v).toBeLessThan(2048);
        }
      }
    }

    // Ensure bitstorm can start with more than tiny 1/2-only number tiles.
    expect(Array.from(seenNumbers).some((value) => value >= 4)).toBe(true);
    expect(seenNumbers.has(2048)).toBe(false);
  });
});
