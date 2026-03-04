import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import { POST } from "@/app/api/games/route";
import { createEntitlementProof } from "@/lib/binary2048/entitlement-proof";

describe("POST /api/games", () => {
  afterEach(() => {
    delete process.env.BINARY2048_ENTITLEMENT_SECRET;
    delete process.env.BINARY2048_AUTH_BRIDGE_SECRET;
  });

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
    expect(json.economy?.canContinueAfterWin).toBe(true);
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
    expect(json.economy?.canContinueAfterWin).toBe(false);
  });

  it("disables lock spawn for ranked games when only plain entitlements are sent", async () => {
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
    expect(json.current?.config?.spawn?.pLock).toBe(0);
    expect(json.economy?.lockTilesEnabled).toBe(false);
    expect(json.economy?.canContinueAfterWin).toBe(false);
  });

  it("keeps lock spawn for ranked games with a valid entitlement proof", async () => {
    process.env.BINARY2048_ENTITLEMENT_SECRET = "ranked-proof-secret";
    const proof = createEntitlementProof(
      {
        entitlements: ["lock_tiles_ranked"],
        exp: Math.floor(Date.now() / 1000) + 60
      },
      process.env.BINARY2048_ENTITLEMENT_SECRET
    );

    const req = new Request("http://localhost/api/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        economy: {
          sessionClass: "ranked",
          userTier: "paid",
          proof
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
    expect(json.economy?.canContinueAfterWin).toBe(false);
  });

  it("keeps lock spawn for ranked games with valid auth-bridge token and no proof", async () => {
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = "auth-bridge-secret";
    const token = createAuthBridgeToken(
      {
        sub: "u_paid",
        exp: Math.floor(Date.now() / 1000) + 60,
        tier: "paid"
      },
      process.env.BINARY2048_AUTH_BRIDGE_SECRET
    );

    const req = new Request("http://localhost/api/games", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        economy: {
          sessionClass: "ranked"
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
    expect(json.economy?.userTier).toBe("paid");
  });
});
