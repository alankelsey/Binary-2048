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
});
