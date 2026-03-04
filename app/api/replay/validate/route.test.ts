import { POST } from "@/app/api/replay/validate/route";
import { runScenario } from "@/lib/binary2048/engine";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("POST /api/replay/validate", () => {
  const config: GameConfig = {
    width: 4,
    height: 4,
    seed: 5151,
    winTile: 2048,
    zeroBehavior: "annihilate",
    spawnOnNoopMove: false,
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

  it("returns ok=true for valid replay payload", async () => {
    const exported = runScenario(config, initialGrid, ["left", "up"]);
    const req = new Request("http://localhost/api/replay/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(exported)
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.reason).toBe("OK");
  });

  it("returns ok=false for invalid replay payload", async () => {
    const req = new Request("http://localhost/api/replay/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ moves: [] })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(false);
    expect(typeof json.reason).toBe("string");
  });
});
