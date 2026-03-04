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

  afterEach(() => {
    delete process.env.BINARY2048_REPLAY_CODE_SECRET;
    delete process.env.BINARY2048_REPLAY_SHARE_SECRET;
  });

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

  it("creates signed replay code when secret is configured and rejects tampered codes", async () => {
    process.env.BINARY2048_REPLAY_CODE_SECRET = "route-replay-secret";
    const exported = runScenario(config, initialGrid, ["left", "up"]);
    const encodedRes = await POST(
      new Request("http://localhost/api/replay/code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(exported)
      })
    );
    const encodedBody = await encodedRes.json();
    expect(encodedRes.status).toBe(200);
    expect(encodedBody.signed).toBe(true);

    const tamperedCode = `${encodedBody.code}x`;
    const decodeRes = await GET(new Request(`http://localhost/api/replay/code?code=${encodeURIComponent(tamperedCode)}`));
    const decodeBody = await decodeRes.json();
    expect(decodeRes.status).toBe(400);
    expect(String(decodeBody.error)).toContain("signature");
  });

  it("falls back to short-lived hosted replay code when replay URL is oversized", async () => {
    process.env.BINARY2048_REPLAY_SHARE_SECRET = "hosted-route-secret";
    const oversizedReplay = {
      header: {
        replayVersion: 1,
        rulesetId: "binary2048-v1",
        engineVersion: "test",
        size: 4,
        seed: 606,
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      config,
      initialGrid,
      moves: Array.from({ length: 5000 }, (_, i) => `left-${i}-${(i * 7919).toString(36)}`)
    };

    const encodedRes = await POST(
      new Request("http://localhost/api/replay/code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(oversizedReplay)
      })
    );
    const encodedBody = await encodedRes.json();
    expect(encodedRes.status).toBe(200);
    expect(encodedBody.hosted).toBe(true);
    expect(encodedBody.overLimit).toBe(false);
    expect(typeof encodedBody.code).toBe("string");

    const decodeRes = await GET(new Request(`http://localhost/api/replay/code?code=${encodeURIComponent(encodedBody.code)}`));
    const decodeBody = await decodeRes.json();
    expect(decodeRes.status).toBe(200);
    expect(Array.isArray(decodeBody.moves)).toBe(true);
    expect(decodeBody.moves.length).toBe(5000);
  });
});
