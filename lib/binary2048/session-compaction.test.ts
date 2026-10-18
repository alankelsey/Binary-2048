import { runScenario } from "./engine";
import {
  createSession,
  exportRecoverySnapshot,
  exportSession,
  getSession,
  importRecoverySnapshot,
  materializeSessionSteps,
  moveSession,
  undoSession
} from "./sessions";
import {
  installSessionStoreForTests,
  resetSessionStoreForTests,
  type SessionStore
} from "./session-store";
import type { Cell, GameConfig } from "./types";

const config: GameConfig = {
  width: 4,
  height: 4,
  seed: 20261018,
  winTile: 2048,
  zeroBehavior: "annihilate",
  spawnOnNoopMove: false,
  spawn: {
    pZero: 0,
    pOne: 0.9,
    pWildcard: 0.1,
    pLock: 0,
    wildcardMultipliers: [2]
  }
};

const initialGrid: Cell[][] = [
  [{ t: "n", v: 1 }, null, null, null],
  [null, null, null, null],
  [null, null, null, null],
  [null, null, null, null]
];

afterEach(() => {
  delete process.env.BINARY2048_RECOVERY_SECRET;
  resetSessionStoreForTests();
});

it("migrates a legacy full-step session to schema v2 on read", async () => {
  const exported = runScenario(config, initialGrid, ["right", "down", "left"]);
  const legacy = {
    initialState: exported.initial,
    current: exported.final,
    steps: exported.steps,
    undoLimit: 2,
    undoUsed: 0,
    undoEvents: [],
    integrity: { sessionClass: "unranked", source: "created" }
  };
  installSessionStoreForTests({
    get: jest.fn().mockResolvedValue(legacy),
    set: jest.fn(),
    delete: jest.fn()
  } as unknown as SessionStore);

  const migrated = await getSession(exported.final.id);

  expect(migrated?.sessionVersion).toBe(2);
  expect(migrated?.steps).toEqual(exported.steps.map(({ turn, dir, moved }) => ({ turn, dir, moved })));
  expect(migrated?.undoStates).toHaveLength(2);
  expect(materializeSessionSteps(migrated!)).toEqual(exported.steps);
});

it("does not retain undo boards when migrating a zero-undo session", async () => {
  const exported = runScenario(config, initialGrid, ["right", "down"]);
  installSessionStoreForTests({
    get: jest.fn().mockResolvedValue({
      initialState: exported.initial,
      current: exported.final,
      steps: exported.steps,
      undoLimit: 0,
      undoUsed: 0,
      undoEvents: [],
      integrity: { sessionClass: "ranked", source: "created" }
    }),
    set: jest.fn(),
    delete: jest.fn()
  } as unknown as SessionStore);

  const migrated = await getSession(exported.final.id);

  expect(migrated?.steps).toHaveLength(2);
  expect(migrated?.undoStates).toEqual([]);
});

it("keeps a 275-command session compact while preserving export, undo, and recovery", async () => {
  process.env.BINARY2048_RECOVERY_SECRET = "session-compaction-recovery-secret";
  const created = await createSession(config, initialGrid);
  const directions = Array.from({ length: 275 }, () => "left" as const);
  for (const direction of directions) await moveSession(created.current.id, direction);

  const compact = (await getSession(created.current.id))!;
  const materialized = materializeSessionSteps(compact);
  const compactBytes = Buffer.byteLength(JSON.stringify(compact));
  const legacyBytes = Buffer.byteLength(JSON.stringify({ ...compact, sessionVersion: 1, steps: materialized }));

  expect(compact.sessionVersion).toBe(2);
  expect(compact.steps).toHaveLength(275);
  expect(compact.steps.every((step) => Object.keys(step).sort().join(",") === "dir,moved,turn")).toBe(true);
  expect(compact.undoStates.length).toBeLessThanOrEqual(2);
  expect(compactBytes).toBeLessThan(legacyBytes * 0.2);

  const exported = await exportSession(created.current.id);
  expect(exported?.steps).toHaveLength(275);
  expect(exported?.final).toEqual(compact.current);
  expect(exported?.meta.replay.moves).toEqual(directions);

  const snapshot = (await exportRecoverySnapshot(created.current.id))!;
  expect(snapshot.moves).toEqual(directions);
  resetSessionStoreForTests();
  const recovered = await importRecoverySnapshot(snapshot);
  expect(recovered.steps).toHaveLength(275);
  expect(recovered.current).toEqual(compact.current);

  const undone = await undoSession(recovered.current.id);
  expect(undone.error).toBeNull();
  expect(undone.session?.steps).toHaveLength(274);
  expect(undone.session?.undoUsed).toBe(1);
});
