import { POST } from "@/app/api/bots/tournament/route";

describe("POST /api/bots/tournament", () => {
  it("runs default tournament payload", async () => {
    const req = new Request("http://localhost/api/bots/tournament", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.rulesetId).toBe("binary2048-v1");
    expect(Array.isArray(json.seeds)).toBe(true);
    expect(Array.isArray(json.bots)).toBe(true);
    expect(Array.isArray(json.ranking)).toBe(true);
    expect(Array.isArray(json.runs)).toBe(true);
    expect(json.runs.length).toBe(json.seeds.length * json.bots.length);
  });

  it("supports explicit seeds and bot subset", async () => {
    const req = new Request("http://localhost/api/bots/tournament", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        seeds: [501, 502],
        maxMoves: 30,
        bots: ["priority", "alternate"]
      })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.seeds).toEqual([501, 502]);
    expect(json.bots).toEqual(["priority", "alternate"]);
    expect(json.runs).toHaveLength(4);
  });
});
