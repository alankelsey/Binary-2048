import { POST } from "@/app/api/games/route";

describe("POST /api/games", () => {
  it("creates a classic game with undo metadata", async () => {
    const req = new Request("http://localhost/api/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(typeof json.id).toBe("string");
    expect(json.mode).toBe("classic");
    expect(json.current?.id).toBe(json.id);
    expect(json.undo?.limit).toBe(2);
    expect(json.undo?.used).toBe(0);
    expect(json.undo?.remaining).toBe(2);
  });

  it("creates bitstorm mode with a seeded prefilled board", async () => {
    const req = new Request("http://localhost/api/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "bitstorm",
        config: { seed: 1234 }
      })
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.mode).toBe("bitstorm");
    const cells = (json.current?.grid ?? []).flat();
    const filled = cells.filter((cell: unknown) => cell !== null).length;
    expect(filled).toBeGreaterThanOrEqual(4);
  });
});
