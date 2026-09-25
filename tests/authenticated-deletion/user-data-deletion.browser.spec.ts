import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

const confirmation = "DELETE_DEDICATED_BINARY2048_TEST_ACCOUNT_DATA";

test("dedicated account authorizes deletion and has no remaining exportable data", async ({ request }) => {
  expect(process.env.ALLOW_PRODUCTION_DATA_DELETION).toBe(confirmation);

  const expectedIdentityHash = process.env.AUTH_DELETION_ACCOUNT_SHA256 ?? "";
  expect(expectedIdentityHash).toMatch(/^[a-f0-9]{64}$/);

  const sessionResponse = await request.get("/api/auth/session");
  expect(sessionResponse.status()).toBe(200);
  const session = await sessionResponse.json();
  const identity = session.user?.email || session.user?.name;
  expect(identity).toEqual(expect.any(String));

  const actualIdentityHash = createHash("sha256").update(identity).digest("hex");
  if (actualIdentityHash !== expectedIdentityHash) {
    throw new Error("Dedicated deletion-test account confirmation does not match the active session.");
  }

  const bridgeResponse = await request.post("/api/auth/bridge-token", {
    data: { ttlSeconds: 300 }
  });
  expect(bridgeResponse.status()).toBe(200);
  const bridge = await bridgeResponse.json();
  expect(bridge.token).toEqual(expect.any(String));
  const headers = { authorization: `Bearer ${bridge.token}` };

  const deletionResponse = await request.delete("/api/user/data", { headers });
  expect(deletionResponse.status()).toBe(200);
  const deletion = await deletionResponse.json();
  const deletedIdentityHash = createHash("sha256")
    .update(deletion.subscriberId ?? "")
    .digest("hex");
  if (deletedIdentityHash !== expectedIdentityHash) {
    throw new Error("Deletion response did not match the confirmed dedicated account.");
  }
  expect(deletion.removed).toEqual({
    subscriptions: expect.any(Number),
    leaderboardEntries: expect.any(Number),
    inventoryRecord: expect.any(Number),
    inventoryLedgerEntries: expect.any(Number)
  });

  const exportResponse = await request.get("/api/user/data/export?limit=100", { headers });
  expect(exportResponse.status()).toBe(200);
  const exported = await exportResponse.json();
  expect(exported.inventory).toBeNull();
  expect(exported.ledger).toEqual([]);
  expect(exported.subscriptions).toEqual([]);
  expect(exported.leaderboard).toEqual([]);
});
