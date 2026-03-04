import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import { GET } from "@/app/api/user/data/export/route";
import { grantInventory, resetInventoryStore } from "@/lib/binary2048/inventory";
import { resetLeaderboard, submitLeaderboardEntry } from "@/lib/binary2048/leaderboard";
import { createSession } from "@/lib/binary2048/sessions";
import { upsertSubscription } from "@/lib/binary2048/subscriptions";
import type { Cell } from "@/lib/binary2048/types";

function authHeader(sub = "u_privacy_export") {
  const secret = process.env.BINARY2048_AUTH_BRIDGE_SECRET ?? "";
  const token = createAuthBridgeToken(
    {
      sub,
      tier: "authed",
      exp: Math.floor(Date.now() / 1000) + 60
    },
    secret
  );
  return { authorization: `Bearer ${token}` };
}

describe("GET /api/user/data/export", () => {
  beforeEach(() => {
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = "privacy-export-secret";
    resetInventoryStore();
    resetLeaderboard();
  });

  afterEach(() => {
    delete process.env.BINARY2048_AUTH_BRIDGE_SECRET;
  });

  it("requires authentication", async () => {
    const res = await GET(new Request("http://localhost/api/user/data/export"));
    expect(res.status).toBe(401);
  });

  it("exports user-linked inventory/subscription/leaderboard data", async () => {
    const subscriberId = "u_privacy_export";
    grantInventory({ subscriberId, sku: "undo_charge", quantity: 2, reason: "grant" });
    upsertSubscription({
      subscriberId,
      transport: "inapp",
      endpoint: "app-ui",
      topics: ["app_updates"],
      enabled: true
    });
    const grid: Cell[][] = [
      [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const session = createSession({ seed: 910, winTile: 2 }, grid, { sessionClass: "ranked" });
    submitLeaderboardEntry({
      playerId: subscriberId,
      userTier: "authed",
      gameId: session.current.id,
      session
    });

    const res = await GET(
      new Request("http://localhost/api/user/data/export", {
        headers: authHeader(subscriberId)
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.subscriberId).toBe(subscriberId);
    expect(json.inventory?.balances?.undo_charge).toBe(2);
    expect(Array.isArray(json.ledger)).toBe(true);
    expect(Array.isArray(json.subscriptions)).toBe(true);
    expect(json.subscriptions.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(json.leaderboard)).toBe(true);
    expect(json.leaderboard.some((entry: { playerId: string }) => entry.playerId === subscriberId)).toBe(true);
  });
});
