import { POST } from "@/app/api/replay/route";
import { runScenario } from "@/lib/binary2048/engine";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("POST /api/replay", () => {
  const config: GameConfig = {
    width: 4,
    height: 4,
    seed: 707,
    winTile: 2048,
    zeroBehavior: "annihilate",
    spawnOnNoopMove: false,
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

  it("replays from full export payload", async () => {
    const exported = runScenario(config, initialGrid, ["left", "up", "right"]);
    const req = new Request("http://localhost/api/replay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(exported)
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.final?.grid).toEqual(exported.final.grid);
    expect(json.final?.score).toBe(exported.final.score);
  });

  it("replays from compact replay request", async () => {
    const req = new Request("http://localhost/api/replay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        header: { rulesetId: "binary2048-v1", seed: 707 },
        config,
        initialGrid,
        moves: ["L", "U"]
      })
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.rulesetId).toBe("binary2048-v1");
    expect(json.movesApplied).toBe(2);
  });

  it("returns 400 for invalid payload", async () => {
    const req = new Request("http://localhost/api/replay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ moves: [] })
    });

    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(typeof json.error).toBe("string");
  });
});
