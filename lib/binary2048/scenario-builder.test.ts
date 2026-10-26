import {
  createEmptyScenarioGrid,
  createScenarioBuilderState,
  resizeScenarioGrid
} from "@/lib/binary2048/scenario-builder";
import type { Cell } from "@/lib/binary2048/types";

describe("scenario builder state", () => {
  it("starts with an independent 4 by 4 empty board and canonical configuration", () => {
    const first = createScenarioBuilderState();
    const second = createScenarioBuilderState();

    expect(first.gameMode).toBe("classic");
    expect(first.config).toMatchObject({ width: 4, height: 4, seed: 42, winTile: 2048 });
    expect(first.grid).toEqual(createEmptyScenarioGrid(4, 4));

    first.config.spawn.wildcardMultipliers.push(16);
    expect(second.config.spawn.wildcardMultipliers).toEqual([2, 4, 8]);
  });

  it("preserves overlapping cells when resizing and fills new cells with empty values", () => {
    const grid: Cell[][] = [
      [{ t: "n", v: 2 }, { t: "z" }],
      [{ t: "w", m: 4 }, { t: "i" }]
    ];

    expect(resizeScenarioGrid(grid, 3, 3)).toEqual([
      [{ t: "n", v: 2 }, { t: "z" }, null],
      [{ t: "w", m: 4 }, { t: "i" }, null],
      [null, null, null]
    ]);
    expect(resizeScenarioGrid(grid, 1, 1)).toEqual([[{ t: "n", v: 2 }]]);
  });
});
