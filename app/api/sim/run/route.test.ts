import { POST } from "@/app/api/sim/run/route";

describe("POST /api/sim/run", () => {
  it("runs deterministic scenario and returns export payload", async () => {
    const req = new Request("http://localhost/api/sim/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        config: {
          width: 4,
          height: 4,
          seed: 99,
          winTile: 2048,
          zeroBehavior: "annihilate",
          spawnOnNoopMove: false,
          spawn: {
            pZero: 0,
            pOne: 1,
            pWildcard: 0,
            wildcardMultipliers: [2]
          }
        },
        initialGrid: [
          [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null]
        ],
        moves: ["left", "up"]
      })
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.version).toBe(1);
    expect(json.meta?.rulesetId).toBe("binary2048-v1");
    expect(Array.isArray(json.steps)).toBe(true);
  });

  it("returns 400 for invalid payload", async () => {
    const req = new Request("http://localhost/api/sim/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ config: { width: 1 } })
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(typeof json.error).toBe("string");
  });
});
