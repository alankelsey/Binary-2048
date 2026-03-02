import { createSession, getSession, moveSession, undoSession } from "@/lib/binary2048/sessions";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("session undo", () => {
  const config: Partial<GameConfig> = {
    width: 4,
    height: 4,
    seed: 222,
    spawn: {
      pZero: 0,
      pOne: 1,
      pWildcard: 0,
      wildcardMultipliers: [2]
    }
  };

  const initialGrid: Cell[][] = [
    [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ];

  it("reverts current state to previous step", () => {
    const session = createSession(config, initialGrid);
    const id = session.current.id;
    const beforeMove = getSession(id)?.current;
    expect(beforeMove).toBeTruthy();

    moveSession(id, "left");
    const afterMove = getSession(id)?.current;
    expect(afterMove?.turn).toBe(1);

    undoSession(id);
    const afterUndo = getSession(id)?.current;
    expect(afterUndo).toEqual(beforeMove);
  });

  it("is safe when there are no steps to undo", () => {
    const session = createSession(config, initialGrid);
    const id = session.current.id;
    const beforeUndo = getSession(id)?.current;
    const undone = undoSession(id);
    expect(undone?.current).toEqual(beforeUndo);
  });
});
