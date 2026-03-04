import { GET } from "@/app/api/games/[id]/export/route";
import { POST as moveGame } from "@/app/api/games/[id]/move/route";
import { createSession } from "@/lib/binary2048/sessions";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("GET /api/games/:id/export", () => {
  const config: Partial<GameConfig> = {
    width: 4,
    height: 4,
    seed: 616,
    spawn: {
      pZero: 0,
      pOne: 1,
      pWildcard: 0,
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
    expect(res.headers.get("content-disposition")).toContain(`${id}.json`);
    expect(json.version).toBe(1);
    expect(json.meta?.rulesetId).toBe("binary2048-v1");
    expect(json.meta?.spawnProbs).toEqual({
      zero: 0,
      one: 1,
      wildcard: 0,
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
});
