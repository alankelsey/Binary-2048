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
    expect(json.integrity?.sessionClass).toBe("unranked");
    expect(json.integrity?.source).toBe("created");
    expect(json.economy?.lockTilesEnabled).toBe(true);
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

  it("disables lock spawn for ranked games without lock entitlement", async () => {
    const req = new Request("http://localhost/api/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        economy: {
          sessionClass: "ranked",
          userTier: "guest",
          entitlements: []
        },
        config: {
          spawn: {
            pZero: 0.15,
            pOne: 0.55,
            pWildcard: 0.1,
            pLock: 0.2,
            wildcardMultipliers: [2]
          }
        }
      })
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.integrity?.sessionClass).toBe("ranked");
    expect(json.current?.config?.spawn?.pLock).toBe(0);
    expect(json.economy?.lockTilesEnabled).toBe(false);
  });

  it("keeps lock spawn for ranked games with lock entitlement", async () => {
    const req = new Request("http://localhost/api/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        economy: {
          sessionClass: "ranked",
          userTier: "paid",
          entitlements: ["lock_tiles_ranked"]
        },
        config: {
          spawn: {
            pZero: 0.15,
            pOne: 0.55,
            pWildcard: 0.1,
            pLock: 0.2,
            wildcardMultipliers: [2]
          }
        }
      })
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.integrity?.sessionClass).toBe("ranked");
    expect(json.current?.config?.spawn?.pLock).toBe(0.2);
    expect(json.economy?.lockTilesEnabled).toBe(true);
  });
});
