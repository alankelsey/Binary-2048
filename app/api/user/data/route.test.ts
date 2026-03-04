import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import { DELETE } from "@/app/api/user/data/route";
import { GET as exportData } from "@/app/api/user/data/export/route";
import { grantInventory, resetInventoryStore } from "@/lib/binary2048/inventory";
import { resetLeaderboard, submitLeaderboardEntry } from "@/lib/binary2048/leaderboard";
import { createSession } from "@/lib/binary2048/sessions";
import { upsertSubscription } from "@/lib/binary2048/subscriptions";
import type { Cell } from "@/lib/binary2048/types";

function authHeader(sub = "u_privacy_delete") {
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

describe("DELETE /api/user/data", () => {
  beforeEach(() => {
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = "privacy-delete-secret";
    resetInventoryStore();
    resetLeaderboard();
  });

  afterEach(() => {
    delete process.env.BINARY2048_AUTH_BRIDGE_SECRET;
  });

  it("requires authentication", async () => {
    const res = await DELETE(new Request("http://localhost/api/user/data", { method: "DELETE" }));
    expect(res.status).toBe(401);
  });

  it("deletes user-linked data and makes export empty", async () => {
    const subscriberId = "u_privacy_delete";
    grantInventory({ subscriberId, sku: "undo_charge", quantity: 3, reason: "grant" });
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
    const session = createSession({ seed: 911, winTile: 2 }, grid, { sessionClass: "ranked" });
    submitLeaderboardEntry({
      playerId: subscriberId,
      userTier: "authed",
      gameId: session.current.id,
      session
    });

    const res = await DELETE(
      new Request("http://localhost/api/user/data", {
        method: "DELETE",
        headers: authHeader(subscriberId)
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.subscriberId).toBe(subscriberId);
    expect(json.removed.subscriptions).toBeGreaterThanOrEqual(1);
    expect(json.removed.leaderboardEntries).toBeGreaterThanOrEqual(1);
    expect(json.removed.inventoryRecord).toBe(1);

    const exportedAfter = await exportData(
      new Request("http://localhost/api/user/data/export", {
        headers: authHeader(subscriberId)
      })
    );
    const exportedJson = await exportedAfter.json();
    expect(exportedAfter.status).toBe(200);
    expect(exportedJson.inventory).toBeNull();
    expect(exportedJson.ledger).toEqual([]);
    expect(exportedJson.subscriptions).toEqual([]);
    expect(exportedJson.leaderboard).toEqual([]);
  });
});
