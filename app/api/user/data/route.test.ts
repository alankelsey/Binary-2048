import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import { DELETE } from "@/app/api/user/data/route";
import { GET as exportData } from "@/app/api/user/data/export/route";
import { grantInventory, resetInventoryStore } from "@/lib/binary2048/inventory";
import { resetLeaderboard, submitLeaderboardEntry } from "@/lib/binary2048/leaderboard";
import { createSession } from "@/lib/binary2048/sessions";
import { upsertSubscription } from "@/lib/binary2048/subscriptions";
import type { Cell } from "@/lib/binary2048/types";

function authHeader(
  sub = "u_privacy_delete",
  exp = Math.floor(Date.now() / 1000) + 60
) {
  const secret = process.env.BINARY2048_AUTH_BRIDGE_SECRET ?? "";
  const token = createAuthBridgeToken(
    {
      sub,
      tier: "authed",
      exp
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

  it("rejects tampered and expired authorization", async () => {
    const tampered = authHeader();
    tampered.authorization = `${tampered.authorization}x`;
    const tamperedResponse = await DELETE(
      new Request("http://localhost/api/user/data", {
        method: "DELETE",
        headers: tampered
      })
    );
    expect(tamperedResponse.status).toBe(401);

    const expiredResponse = await DELETE(
      new Request("http://localhost/api/user/data", {
        method: "DELETE",
        headers: authHeader("u_privacy_delete", Math.floor(Date.now() / 1000) - 1)
      })
    );
    expect(expiredResponse.status).toBe(401);
  });

  it("deletes only the authenticated user's linked data", async () => {
    const subscriberId = "u_privacy_delete";
    const otherSubscriberId = "u_privacy_delete_other";
    grantInventory({ subscriberId, sku: "undo_charge", quantity: 3, reason: "grant" });
    grantInventory({ subscriberId: otherSubscriberId, sku: "undo_charge", quantity: 2, reason: "grant" });
    upsertSubscription({
      subscriberId,
      transport: "inapp",
      endpoint: "app-ui",
      topics: ["app_updates"],
      enabled: true
    });
    upsertSubscription({
      subscriberId: otherSubscriberId,
      transport: "inapp",
      endpoint: "other-app-ui",
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
    const otherSession = createSession({ seed: 912, winTile: 2 }, grid, { sessionClass: "ranked" });
    submitLeaderboardEntry({
      playerId: otherSubscriberId,
      userTier: "authed",
      gameId: otherSession.current.id,
      session: otherSession
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

    const otherExport = await exportData(
      new Request("http://localhost/api/user/data/export", {
        headers: authHeader(otherSubscriberId)
      })
    );
    const otherJson = await otherExport.json();
    expect(otherExport.status).toBe(200);
    expect(otherJson.inventory?.balances?.undo_charge).toBe(2);
    expect(otherJson.ledger).toHaveLength(1);
    expect(otherJson.subscriptions).toHaveLength(1);
    expect(otherJson.leaderboard).toHaveLength(1);
  });
});
