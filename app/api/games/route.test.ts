import { createHmac } from "crypto";
import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import { POST } from "@/app/api/games/route";
import { createEntitlementProof } from "@/lib/binary2048/entitlement-proof";

function toBase64Url(input: string) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signHeaderClaims(encodedClaims: string, secret: string) {
  return createHmac("sha256", secret)
    .update(encodedClaims)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

describe("POST /api/games", () => {
  afterEach(() => {
    delete process.env.BINARY2048_ENTITLEMENT_SECRET;
    delete process.env.BINARY2048_AUTH_BRIDGE_SECRET;
    delete process.env.BINARY2048_AUTH_HEADER_SECRET;
    delete process.env.BINARY2048_CHALLENGE_MODE;
    delete process.env.BINARY2048_CHALLENGE_SECRET;
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

  it("returns 403 for guest game creation when challenge is enforced and token missing", async () => {
    process.env.BINARY2048_CHALLENGE_MODE = "enforce";
    process.env.BINARY2048_CHALLENGE_SECRET = "challenge-secret";
    const req = new Request("http://localhost/api/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });

    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error).toBe("Challenge required");
  });

  it("randomizes seed for classic games when seed is omitted", async () => {
    const randomSpy = jest
      .spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.111111)
      .mockReturnValueOnce(0.5);
    try {
      const reqA = new Request("http://localhost/api/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      });
      const reqB = new Request("http://localhost/api/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      });

      const resA = await POST(reqA);
      const jsonA = await resA.json();
      const resB = await POST(reqB);
      const jsonB = await resB.json();

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(jsonA.current?.seed).toBe(1);
      expect(jsonB.current?.seed).toBeGreaterThan(1);
      expect(jsonA.current?.seed).not.toBe(jsonB.current?.seed);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it("respects explicit seed for classic games", async () => {
    const req = new Request("http://localhost/api/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        config: {
          seed: 9999
        }
      })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.current?.seed).toBe(9999);
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

  it("keeps lock spawn for ranked games with signed auth header claims", async () => {
    process.env.BINARY2048_AUTH_HEADER_SECRET = "header-bridge-secret";
    const encodedClaims = toBase64Url(
      JSON.stringify({
        sub: "u_header_paid",
        exp: Math.floor(Date.now() / 1000) + 60,
        tier: "paid"
      })
    );
    const sig = signHeaderClaims(encodedClaims, process.env.BINARY2048_AUTH_HEADER_SECRET);

    const req = new Request("http://localhost/api/games", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-binary2048-auth-claims": encodedClaims,
        "x-binary2048-auth-sig": sig
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
    expect(json.current?.config?.spawn?.pLock).toBe(0.2);
    expect(json.economy?.lockTilesEnabled).toBe(true);
    expect(json.economy?.userTier).toBe("paid");
  });
});
