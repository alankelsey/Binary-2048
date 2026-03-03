import { GET, POST } from "@/app/api/replay/code/route";
import { runScenario } from "@/lib/binary2048/engine";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("api replay code", () => {
  const config: GameConfig = {
    width: 4,
    height: 4,
    seed: 606,
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

  it("creates shareable replay code from export payload", async () => {
    const exported = runScenario(config, initialGrid, ["left", "up"]);
    const req = new Request("http://localhost/api/replay/code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(exported)
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(typeof json.code).toBe("string");
    expect(typeof json.length).toBe("number");
    expect(typeof json.compressed).toBe("boolean");
  });

  it("decodes shareable replay code", async () => {
    const exported = runScenario(config, initialGrid, ["left", "up"]);
    const encoded = await POST(
      new Request("http://localhost/api/replay/code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(exported)
      })
    );
    const body = await encoded.json();
    const res = await GET(new Request(`http://localhost/api/replay/code?code=${encodeURIComponent(body.code)}`));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json?.header?.rulesetId).toBe("binary2048-v1");
    expect(json?.moves).toEqual(["left", "up"]);
  });

  it("returns 400 for invalid replay code", async () => {
    const res = await GET(new Request("http://localhost/api/replay/code?code=%%%bad%%%"));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(typeof json.error).toBe("string");
  });
});
