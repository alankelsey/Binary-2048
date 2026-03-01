import { computeCellEffects, type MoveEvent } from "@/lib/binary2048/cell-effects";

type Tile = { t: "n"; v: number } | { t: "z" } | { t: "w"; m: number };
type Cell = Tile | null;

type S = { width: number; height: number; grid: Cell[][] };

describe("computeCellEffects", () => {
  it("applies zero-bust to combined destination tile and spawn effect to spawned tile", () => {
    const prev: S = {
      width: 2,
      height: 2,
      grid: [
        [{ t: "z" }, { t: "n", v: 1 }],
        [null, null]
      ]
    };

    // zero collides with number and resulting tile lands at 0-1; a new tile spawns at 1-0
    const next: S = {
      width: 2,
      height: 2,
      grid: [
        [null, { t: "n", v: 1 }],
        [{ t: "n", v: 1 }, null]
      ]
    };

    const events: MoveEvent[] = [
      { type: "merge", at: [0, 0] },
      { type: "spawn", at: [1, 0] }
    ];

    const effects = computeCellEffects(prev, next, events, "right");

    expect(effects["0-1"]).toBe("zero-bust");
    expect(effects["1-0"]).toBe("spawn");
    expect(effects["1-0"]).not.toBe("zero-bust");
  });

  it("targets zero-bust on collision destination even when a spawn exists earlier in scan order", () => {
    const prev: S = {
      width: 4,
      height: 4,
      grid: [
        [{ t: "n", v: 1 }, null, null, null],
        [{ t: "n", v: 1 }, { t: "z" }, null, null],
        [{ t: "n", v: 2 }, { t: "n", v: 4 }, null, null],
        [{ t: "n", v: 16 }, { t: "n", v: 4 }, null, null]
      ]
    };

    const next: S = {
      width: 4,
      height: 4,
      grid: [
        [null, null, { t: "n", v: 1 }, { t: "n", v: 1 }],
        [null, null, null, { t: "n", v: 1 }],
        [null, null, { t: "n", v: 2 }, { t: "n", v: 4 }],
        [null, null, { t: "n", v: 16 }, { t: "n", v: 4 }]
      ]
    };

    const events: MoveEvent[] = [
      { type: "merge", at: [-1, -1] },
      { type: "spawn", at: [0, 3] }
    ];

    const effects = computeCellEffects(prev, next, events, "right");

    expect(effects["1-3"]).toBe("zero-bust");
    expect(effects["0-3"]).toBe("spawn");
    expect(effects["0-3"]).not.toBe("zero-bust");
  });
});
