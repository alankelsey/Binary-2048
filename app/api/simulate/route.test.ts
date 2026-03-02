import { POST } from "@/app/api/simulate/route";

describe("POST /api/simulate", () => {
  it("accepts compact actions and returns final artifacts", async () => {
    const req = new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        seed: 77,
        moves: ["L", "U", "R"],
        config: { size: 4 }
      })
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.rulesetId).toBe("binary2048-v1");
    expect(typeof json.totalScore).toBe("number");
    expect(typeof json.finalStateHash).toBe("string");
    expect(Array.isArray(json.finalEncodedFlat)).toBe(true);
    expect(json.finalEncodedFlat.length).toBe(4 * 4 * 2);
    expect(Array.isArray(json.finalActionMask)).toBe(true);
    expect(json.finalActionMask).toHaveLength(4);
  });

  it("returns 400 for invalid direction token", async () => {
    const req = new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        seed: 88,
        moves: ["LEFT"],
        config: { size: 4 }
      })
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(typeof json.error).toBe("string");
  });
});
