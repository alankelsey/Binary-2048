import {
  createSession,
  exportRecoverySnapshot,
  getSession,
  importRecoverySnapshot,
  moveSession,
  resolveSessionWithRecovery,
  undoSession
} from "@/lib/binary2048/sessions";
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
      pLock: 0,
      wildcardMultipliers: [2]
    }
  };

  const initialGrid: Cell[][] = [
    [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ];

  afterEach(() => {
    delete process.env.BINARY2048_RECOVERY_SECRET;
  });

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
          pLock: 0,
          wildcardMultipliers: [2]
        }
      },
      initialGrid
    );
    const deathId = deathSession.current.id;
    moveSession(deathId, "left");
    expect(undoSession(deathId).error).toBe("LIMIT_REACHED");
  });

  it("marks created sessions as unranked created", () => {
    const session = createSession(config, initialGrid);
    expect(session.integrity.sessionClass).toBe("unranked");
    expect(session.integrity.source).toBe("created");
  });

  it("reconstructs the current game from a compact recovery snapshot", () => {
    const session = createSession(config, initialGrid);
    moveSession(session.current.id, "left");
    const snapshot = exportRecoverySnapshot(session.current.id);
    expect(snapshot?.moves).toEqual(["left"]);

    const recovered = importRecoverySnapshot(snapshot!);
    expect(recovered.current.grid).toEqual(getSession(session.current.id)?.current.grid);
    expect(recovered.current.score).toBe(getSession(session.current.id)?.current.score);
    expect(recovered.steps).toHaveLength(1);
  });

  it("does not roll current state back to an older signed browser snapshot", () => {
    process.env.BINARY2048_RECOVERY_SECRET = "session-recovery-secret";
    const session = createSession(config, initialGrid);
    const id = session.current.id;
    moveSession(id, "left");
    const olderSnapshot = exportRecoverySnapshot(id)!;
    moveSession(id, "right");

    const resolved = resolveSessionWithRecovery(id, olderSnapshot);

    expect(resolved?.steps.map((step) => step.dir)).toEqual(["left", "right"]);
  });

  it("does not replace current state with an unsigned browser snapshot", () => {
    process.env.BINARY2048_RECOVERY_SECRET = "session-recovery-secret";
    const session = createSession(config, initialGrid);
    const id = session.current.id;
    const unsignedSnapshot = {
      ...exportRecoverySnapshot(id)!,
      signature: undefined,
      moves: ["left" as const, "right" as const]
    };

    const resolved = resolveSessionWithRecovery(id, unsignedSnapshot);

    expect(resolved?.steps).toHaveLength(0);
  });
});
