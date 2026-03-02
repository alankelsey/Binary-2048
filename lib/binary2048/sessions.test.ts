import { createSession, getSession, moveSession, undoSession } from "@/lib/binary2048/sessions";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("session undo", () => {
  const config: Partial<GameConfig> = {
    width: 4,
    height: 4,
    seed: 222,
    spawn: {
      pZero: 0,
      pOne: 0.9,
      pWildcard: 0.1,
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

    const undone = undoSession(id);
    expect(undone.error).toBeNull();
    const afterUndo = getSession(id)?.current;
    expect(afterUndo).toEqual(beforeMove);
  });

  it("is safe when there are no steps to undo", () => {
    const session = createSession(config, initialGrid);
    const id = session.current.id;
    const beforeUndo = getSession(id)?.current;
    const undone = undoSession(id);
    expect(undone.session?.current).toEqual(beforeUndo);
  });

  it("enforces undo limits by difficulty mode", () => {
    const normalSession = createSession(config, initialGrid);
    const normalId = normalSession.current.id;
    moveSession(normalId, "left");
    moveSession(normalId, "right");
    moveSession(normalId, "left");
    expect(undoSession(normalId).error).toBeNull();
    expect(undoSession(normalId).error).toBeNull();
    expect(undoSession(normalId).error).toBe("LIMIT_REACHED");

    const deathSession = createSession(
      {
        ...config,
        spawn: {
          pZero: 0,
          pOne: 0.96,
          pWildcard: 0.04,
          wildcardMultipliers: [2]
        }
      },
      initialGrid
    );
    const deathId = deathSession.current.id;
    moveSession(deathId, "left");
    expect(undoSession(deathId).error).toBe("LIMIT_REACHED");
  });
});
