import {
  advanceAnchoredLockLifecycle,
  createAnchoredLockPrototypeState,
  previewAnchoredLockMove,
  resolveAnchoredLockLine
} from "@/lib/binary2048/anchored-lock-prototype";
import type { Cell } from "@/lib/binary2048/types";

const n = (value: number) => ({ t: "n" as const, v: value });
const lock = { t: "i" as const };
const empty = null;

describe("anchored Lock-0 line-resolution prototype", () => {
  it("keeps the lock index fixed and merges each horizontal segment toward the swipe", () => {
    const line: Cell[] = [n(2), empty, n(2), lock, n(4), empty, n(4)];

    expect(resolveAnchoredLockLine(line)).toEqual({
      line: [n(4), empty, empty, lock, n(8), empty, empty],
      moved: true,
      gainedScore: 12
    });
    expect(line).toEqual([n(2), empty, n(2), lock, n(4), empty, n(4)]);
  });

  it.each([
    ["left", [[n(4), empty, empty, lock, n(8), empty, empty]]],
    ["right", [[empty, empty, n(4), lock, empty, empty, n(8)]]]
  ] as const)("partitions a row while swiping %s", (direction, expected) => {
    const grid: Cell[][] = [[n(2), empty, n(2), lock, n(4), empty, n(4)]];

    const result = previewAnchoredLockMove(grid, direction);

    expect(result.grid).toEqual(expected);
    expect(result.grid[0][3]).toEqual(lock);
    expect(result.gainedScore).toBe(12);
  });

  it.each([
    ["up", [[n(4)], [empty], [empty], [lock], [n(8)], [empty], [empty]]],
    ["down", [[empty], [empty], [n(4)], [lock], [empty], [empty], [n(8)]]]
  ] as const)("partitions a column while swiping %s", (direction, expected) => {
    const grid: Cell[][] = [[n(2)], [empty], [n(2)], [lock], [n(4)], [empty], [n(4)]];

    const result = previewAnchoredLockMove(grid, direction);

    expect(result.grid).toEqual(expected);
    expect(result.grid[3][0]).toEqual(lock);
    expect(result.gainedScore).toBe(12);
  });

  it("treats the lock as a board edge while ordinary tiles stop adjacent to it", () => {
    const grid: Cell[][] = [[empty, n(2), empty, lock, empty, n(4), empty]];

    expect(previewAnchoredLockMove(grid, "right").grid).toEqual([
      [empty, empty, n(2), lock, empty, empty, n(4)]
    ]);
    expect(previewAnchoredLockMove(grid, "left").grid).toEqual([
      [n(2), empty, empty, lock, n(4), empty, empty]
    ]);
  });

  it("removes a lock after its second collision but lets the tile pass only on a later swipe", () => {
    const initial = createAnchoredLockPrototypeState([
      [empty, empty, lock, empty, empty, n(2)]
    ]);

    const first = advanceAnchoredLockLifecycle(initial, "left");
    expect(first.state.grid).toEqual([[empty, empty, lock, n(2), empty, empty]]);
    expect(first.state.lockCollisions).toEqual({ "0:2": 1 });
    expect(first.collisions).toEqual([[0, 2]]);
    expect(first.removedLocks).toEqual([]);

    const second = advanceAnchoredLockLifecycle(first.state, "left");
    expect(second.tileMotion).toBe(false);
    expect(second.gridChanged).toBe(true);
    expect(second.state.grid).toEqual([[empty, empty, empty, n(2), empty, empty]]);
    expect(second.state.lockCollisions).toEqual({});
    expect(second.removedLocks).toEqual([[0, 2]]);

    const third = advanceAnchoredLockLifecycle(second.state, "left");
    expect(third.state.grid).toEqual([[n(2), empty, empty, empty, empty, empty]]);
    expect(third.collisions).toEqual([]);
  });

  it("does not age a lock when tiles move away from it", () => {
    const state = createAnchoredLockPrototypeState([
      [n(2), empty, lock, empty, empty, empty]
    ]);

    const result = advanceAnchoredLockLifecycle(state, "left");

    expect(result.collisions).toEqual([]);
    expect(result.state.lockCollisions).toEqual({ "0:2": 0 });
  });

  it.each([
    ["zero", { t: "z" } as Cell],
    ["wildcard", { t: "w", m: 2 } as Cell]
  ])("allows a %s tile to trigger the candidate lifecycle", (_name, tile) => {
    const state = createAnchoredLockPrototypeState([
      [empty, lock, empty, tile]
    ]);

    const result = advanceAnchoredLockLifecycle(state, "left");

    expect(result.collisions).toEqual([[0, 1]]);
    expect(result.state.lockCollisions).toEqual({ "0:1": 1 });
  });

  it("ages locks independently by coordinate", () => {
    const state = createAnchoredLockPrototypeState([
      [empty, lock, empty, n(2)],
      [empty, lock, empty, empty]
    ]);

    const result = advanceAnchoredLockLifecycle(state, "left");

    expect(result.state.lockCollisions).toEqual({ "0:1": 1, "1:1": 0 });
  });
});
