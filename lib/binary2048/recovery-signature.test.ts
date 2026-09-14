import { resetSessionStoreForTests } from "@/lib/binary2048/session-store";
import {
  createSession,
  exportRecoverySnapshot,
  importRecoverySnapshot,
  moveSession,
  undoSession
} from "@/lib/binary2048/sessions";
import type { Cell } from "@/lib/binary2048/types";

const initialGrid: Cell[][] = [
  [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
  [null, null, null, null],
  [null, null, null, null],
  [null, null, null, null]
];

describe("signed session recovery", () => {
  beforeEach(() => {
    resetSessionStoreForTests();
    process.env.BINARY2048_RECOVERY_SECRET = "recovery-test-secret";
  });

  afterEach(() => {
    delete process.env.BINARY2048_RECOVERY_SECRET;
    resetSessionStoreForTests();
  });

  it("preserves ranked integrity, session id, and undo audit", () => {
    const session = createSession({ seed: 7101 }, initialGrid, { sessionClass: "ranked" });
    moveSession(session.current.id, "left");
    undoSession(session.current.id);
    moveSession(session.current.id, "left");
    const snapshot = exportRecoverySnapshot(session.current.id)!;
    expect(snapshot.signature).toEqual(expect.any(String));

    resetSessionStoreForTests();
    const recovered = importRecoverySnapshot(JSON.parse(JSON.stringify(snapshot)));

    expect(recovered.current.id).toBe(session.current.id);
    expect(recovered.integrity).toEqual({ sessionClass: "ranked", source: "created" });
    expect(recovered.undoUsed).toBe(1);
    expect(recovered.undoEvents).toHaveLength(1);
  });

  it("downgrades a modified signed snapshot to unranked imported", () => {
    const session = createSession({ seed: 7102 }, initialGrid, { sessionClass: "ranked" });
    const snapshot = exportRecoverySnapshot(session.current.id)!;
    snapshot.moves.push("left");

    resetSessionStoreForTests();
    const recovered = importRecoverySnapshot(snapshot);

    expect(recovered.integrity.sessionClass).toBe("unranked");
    expect(recovered.integrity.source).toBe("imported");
    expect(recovered.current.id).not.toBe(session.current.id);
  });
});
