import { POST } from "@/app/api/replay/postmortem/route";
import { DEFAULT_CONFIG } from "@/lib/binary2048/engine";

describe("POST /api/replay/postmortem", () => {
  it("returns top costly moves for compact replay payload", async () => {
    const req = new Request("http://localhost/api/replay/postmortem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        header: {
          replayVersion: 1,
          rulesetId: "binary2048-v1",
          engineVersion: "test",
          size: 4,
          seed: 77,
          createdAt: new Date().toISOString()
        },
        config: { ...DEFAULT_CONFIG, seed: 77 },
        initialGrid: [
          [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null]
        ],
        moves: ["L", "R", "U", "D", "R"]
      })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.analyzedMoves).toBeGreaterThan(0);
    expect(Array.isArray(json.topCostlyMoves)).toBe(true);
    expect(json.topCostlyMoves.length).toBeGreaterThan(0);
    expect(json.topCostlyMoves[0]).toHaveProperty("opportunityCost");
  });

  it("rejects invalid payload", async () => {
    const req = new Request("http://localhost/api/replay/postmortem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bad: true })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(typeof json.error).toBe("string");
  });
});
