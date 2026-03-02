import { POST } from "@/app/api/games/import/route";
import { runScenario } from "@/lib/binary2048/engine";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

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
});
