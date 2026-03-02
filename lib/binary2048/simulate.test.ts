import { simulateBatch, type SimulateBatchRequest } from "@/lib/binary2048/simulate";
import type { Cell } from "@/lib/binary2048/types";

describe("simulateBatch", () => {
  it("runs moves and returns deterministic summaries for same seed", () => {
    const req: SimulateBatchRequest = {
      seed: 55,
      moves: ["left", "up", "left"],
      config: {
        width: 4,
        height: 4
      }
    };
    const a = simulateBatch({ ...req });
    const b = simulateBatch({ ...req });
    expect(a.totalScore).toBe(b.totalScore);
    expect(a.final.grid).toEqual(b.final.grid);
    expect(a.stepSummaries).toEqual(b.stepSummaries);
  });

  it("supports explicit initial grid", () => {
    const initialGrid: Cell[][] = [
      [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const result = simulateBatch({
      seed: 9,
      initialGrid,
      moves: ["left"],
      config: {
        width: 4,
        height: 4,
        spawn: {
          pZero: 0,
          pOne: 1,
          pWildcard: 0,
          wildcardMultipliers: [2]
        }
      }
    });

    expect(result.movesApplied).toBe(1);
    expect(result.stepSummaries[0]?.reward).toBe(2);
  });

  it("accepts compact action codes", () => {
    const result = simulateBatch({
      seed: 101,
      moves: ["L", "U", "R", "D"],
      config: { size: 4 }
    });
    expect(result.movesApplied).toBe(4);
    expect(result.stepSummaries[0]?.action).toBe("L");
  });
});
