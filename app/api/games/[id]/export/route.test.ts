import { GET } from "@/app/api/games/[id]/export/route";
import { POST as moveGame } from "@/app/api/games/[id]/move/route";
import { POST as undoGame } from "@/app/api/games/[id]/undo/route";
import { createSession } from "@/lib/binary2048/sessions";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("GET /api/games/:id/export", () => {
  const config: Partial<GameConfig> = {
    width: 4,
    height: 4,
    seed: 616,
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
    delete process.env.BINARY2048_REPLAY_CODE_SECRET;
  });

  it("returns downloadable export json for existing game", async () => {
    const session = createSession(config, initialGrid);
    const id = session.current.id;

    const res = await GET(new Request("http://localhost/api/games/x/export"), {
      params: Promise.resolve({ id })
    });
    const text = await res.text();
    const json = JSON.parse(text);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const disposition = res.headers.get("content-disposition") ?? "";
    expect(disposition).toContain(`${id}-`);
    expect(disposition).toContain(".json");
    expect(json.version).toBe(1);
    expect(json.meta?.rulesetId).toBe("binary2048-v1");
    expect(json.meta?.spawnProbs).toEqual({
      zero: 0,
      one: 0.9,
      wildcard: 0.1,
      lock: 0,
      wildcardMultipliers: [2]
    });
  });

  it("returns 404 for unknown game id", async () => {
    const res = await GET(new Request("http://localhost/api/games/x/export"), {
      params: Promise.resolve({ id: "missing_game" })
    });
    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.error).toBe("Game not found");
  });

  it("returns compact replay payload when compact=1 is requested", async () => {
    const session = createSession(config, initialGrid);
    const id = session.current.id;

    const res = await GET(new Request("http://localhost/api/games/x/export?compact=1"), {
      params: Promise.resolve({ id })
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.header?.replayVersion).toBe(1);
    expect(json.header?.rulesetId).toBe("binary2048-v1");
    expect(Array.isArray(json.moves)).toBe(true);
    expect(json.version).toBeUndefined();
    expect(json.config).toBeUndefined();
  });

  it("adds audit hash chain when audit=1 is requested", async () => {
    const session = createSession(config, initialGrid);
    const id = session.current.id;

    await moveGame(
      new Request("http://localhost/api/games/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dir: "left" })
      }),
      { params: Promise.resolve({ id }) }
    );

    const res = await GET(new Request("http://localhost/api/games/x/export?audit=1"), {
      params: Promise.resolve({ id })
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.meta?.audit?.mode).toBe("sha256-chain-v1");
    expect(typeof json.meta?.audit?.initialHash).toBe("string");
    expect(Array.isArray(json.meta?.audit?.stepHashes)).toBe(true);
    expect(json.meta?.audit?.stepsHashed).toBe(json.steps.length);
    expect(typeof json.meta?.audit?.finalHash).toBe("string");
  });

  it("includes replay signature when signing secret is configured", async () => {
    process.env.BINARY2048_REPLAY_CODE_SECRET = "export-sign-secret";
    const session = createSession(config, initialGrid);
    const id = session.current.id;

    const compactRes = await GET(new Request("http://localhost/api/games/x/export?compact=1"), {
      params: Promise.resolve({ id })
    });
    const compactJson = await compactRes.json();
    expect(compactRes.status).toBe(200);
    expect(typeof compactJson.signature).toBe("string");

    const fullRes = await GET(new Request("http://localhost/api/games/x/export"), {
      params: Promise.resolve({ id })
    });
    const fullJson = await fullRes.json();
    expect(fullRes.status).toBe(200);
    expect(typeof fullJson.signature).toBe("string");
    expect(fullJson.meta?.replay?.signature).toBe(fullJson.signature);
  });

  it("includes undo accounting metadata in export", async () => {
    const session = createSession(config, initialGrid);
    const id = session.current.id;

    await moveGame(
      new Request("http://localhost/api/games/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dir: "left" })
      }),
      { params: Promise.resolve({ id }) }
    );

    await undoGame(new Request("http://localhost/api/games/undo", { method: "POST" }), {
      params: Promise.resolve({ id })
    });

    const res = await GET(new Request("http://localhost/api/games/x/export"), {
      params: Promise.resolve({ id })
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.meta?.undo?.limit).toBe(2);
    expect(json.meta?.undo?.used).toBe(1);
    expect(json.meta?.undo?.remaining).toBe(1);
    expect(Array.isArray(json.meta?.undo?.events)).toBe(true);
    expect(json.meta?.undo?.events).toHaveLength(1);
    expect(json.meta?.undo?.events[0]).toEqual(
      expect.objectContaining({
        i: 0,
        undoneTurn: 1,
        usedAfter: 1
      })
    );
  });
});
