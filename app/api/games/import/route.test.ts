import { POST } from "@/app/api/games/import/route";
import { runScenario } from "@/lib/binary2048/engine";
import { createRecoverySignature } from "@/lib/binary2048/recovery-signature";
import { COMPACT_RECOVERY_VERSION } from "@/lib/binary2048/compact-recovery";
import { getSession } from "@/lib/binary2048/sessions";
import type { Cell, GameConfig, GameExport } from "@/lib/binary2048/types";

describe("POST /api/games/import", () => {
  const config: GameConfig = {
    width: 4,
    height: 4,
    seed: 515,
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
    [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ];

  it("imports a valid export payload", async () => {
    const payload = runScenario(config, initialGrid, ["left", "up"]);
    const req = new Request("http://localhost/api/games/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(typeof json.id).toBe("string");
    expect(Array.isArray(json.steps)).toBe(true);
    expect(json.undo?.limit).toBe(2);
    expect(json.integrity?.sessionClass).toBe("unranked");
    expect(json.integrity?.source).toBe("imported");
    expect(typeof json.integrity?.importedFromRulesetId).toBe("string");
  });

  it("keeps accepting a legacy unversioned full export", async () => {
    const legacy: Partial<GameExport> = { ...runScenario(config, initialGrid, ["left"]) };
    delete legacy.version;
    const req = new Request("http://localhost/api/games/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(legacy)
    });

    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.steps.map((step: { dir: string }) => step.dir)).toEqual(["left"]);
  });

  it("returns 400 for invalid payload", async () => {
    const req = new Request("http://localhost/api/games/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nope: true })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(typeof json.error).toBe("string");
  });

  it.each([
    ["recovery snapshot", { recoveryVersion: 2, rulesetId: "binary2048-v1", config, initialGrid, moves: [] }, "Unsupported recovery snapshot version: 2"],
    ["compact recovery", { version: "checkpoint-tail-v2", checkpoint: {}, acknowledgedTail: [] }, "Unsupported compact recovery version: checkpoint-tail-v2"],
    ["full export", { ...runScenario(config, initialGrid, []), version: 2 }, "Unsupported game export version: 2"]
  ])("rejects an unsupported %s envelope explicitly", async (_label, payload, message) => {
    const req = new Request("http://localhost/api/games/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: message });
  });

  it("imports a compact recovery snapshot", async () => {
    const req = new Request("http://localhost/api/games/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recoveryVersion: 1, rulesetId: "binary2048-v1", config, initialGrid, moves: ["left"] })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.current.turn).toBe(1);
    expect(json.recoverySnapshot).toMatchObject({ recoveryVersion: 1, moves: ["left"] });
  });

  it("replays a bounded tail from a trusted signed checkpoint", async () => {
    process.env.BINARY2048_RECOVERY_SECRET = "compact-recovery-test-secret";
    const checkpoint = {
      recoveryVersion: 1 as const,
      rulesetId: "binary2048-v1" as const,
      sessionId: "g_compact_recovery",
      config,
      initialGrid,
      moves: ["left"] as Array<"left">,
      integrity: { sessionClass: "ranked" as const, source: "created" as const },
      undo: { limit: 0, used: 0, events: [] as [] }
    };
    const payload = {
      version: COMPACT_RECOVERY_VERSION,
      checkpoint: { ...checkpoint, signature: createRecoverySignature(checkpoint, process.env.BINARY2048_RECOVERY_SECRET) },
      acknowledgedTail: ["down" as const, "right" as const]
    };
    const req = new Request("http://localhost/api/games/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe("g_compact_recovery");
    expect(json.steps.map((step: { dir: string }) => step.dir)).toEqual(["left", "down", "right"]);
    expect(json.integrity).toMatchObject({ sessionClass: "ranked", source: "created" });
    expect(json.recoverySnapshot.moves).toEqual(["left", "down", "right"]);
    delete process.env.BINARY2048_RECOVERY_SECRET;
  });

  it("rejects an unsigned compact recovery checkpoint", async () => {
    const req = new Request("http://localhost/api/games/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        version: COMPACT_RECOVERY_VERSION,
        checkpoint: { recoveryVersion: 1, rulesetId: "binary2048-v1", config, initialGrid, moves: [] },
        acknowledgedTail: []
      })
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("imports a compact recovery history with 250 moves", async () => {
    const longInitialGrid: Cell[][] = [
      [{ t: "n", v: 1 }, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const moves = Array.from({ length: 250 }, () => "left" as const);
    const req = new Request("http://localhost/api/games/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recoveryVersion: 1,
        rulesetId: "binary2048-v1",
        config,
        initialGrid: longInitialGrid,
        moves
      })
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.steps).toHaveLength(250);
    expect(json.recoverySnapshot.moves).toHaveLength(250);
    const stored = await getSession(json.id);
    expect(stored?.sessionVersion).toBe(2);
    expect(stored?.steps).toHaveLength(250);
    expect(stored?.steps.every((step) => !("before" in step) && !("after" in step))).toBe(true);
    expect(stored?.undoStates.length).toBeLessThanOrEqual(2);
  });

  it("returns 413 for an oversized import body", async () => {
    const req = new Request("http://localhost/api/games/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blob: "x".repeat(257 * 1024) })
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(413);
    expect(json.error).toBe("Request body too large");
  });
});
