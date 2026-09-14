import { expect, test } from "@playwright/test";
import { applyMove } from "@/lib/binary2048/engine";
import type { Dir, GameState, SessionRecoverySnapshot } from "@/lib/binary2048/types";

test.describe.configure({ mode: "serial" });

let bridgeToken = "";
let bridgeUserTier: "authed" | "paid" = "authed";

test("real OAuth session is authenticated and survives refresh", async ({ page, request }) => {
  const sessionResponse = await request.get("/api/auth/session");
  expect(sessionResponse.status()).toBe(200);
  const session = await sessionResponse.json();
  expect(session.user?.email || session.user?.name).toBeTruthy();
  expect(["authed", "paid"]).toContain(session.tier);

  await page.goto("/auth");
  await expect(page.getByText("Authenticated: yes")).toBeVisible();
  await expect(page.getByText(/Tier: (authed|paid)/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("Authenticated: yes")).toBeVisible();
});

test("authenticated session mints a usable short-lived bridge token", async ({ request }) => {
  const response = await request.post("/api/auth/bridge-token", { data: { ttlSeconds: 300 } });
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.token).toEqual(expect.any(String));
  expect(payload.token.length).toBeGreaterThan(40);
  expect(["authed", "paid"]).toContain(payload.userTier);
  bridgeToken = payload.token;
  bridgeUserTier = payload.userTier;
});

test("bridge identity authorizes protected read-only user export", async ({ request }) => {
  expect(bridgeToken).toBeTruthy();
  const response = await request.get("/api/user/data/export?limit=5", {
    headers: { authorization: `Bearer ${bridgeToken}` }
  });
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.subscriberId).toBeTruthy();
  expect(Array.isArray(payload.ledger)).toBe(true);
  expect(Array.isArray(payload.subscriptions)).toBe(true);
  expect(Array.isArray(payload.leaderboard)).toBe(true);
});

test("real identity can finish and submit a recovery-safe ranked practice session", async ({ request }) => {
  test.setTimeout(180_000);
  expect(bridgeToken).toBeTruthy();
  const response = await request.post("/api/games", {
    headers: { authorization: `Bearer ${bridgeToken}` },
    data: { config: { seed: 91001 }, economy: { sessionClass: "ranked" } }
  });
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.integrity).toMatchObject({ sessionClass: "ranked", source: "created" });
  expect(payload.economy.userTier).toMatch(/^(authed|paid)$/);
  expect(payload.economy.canContinueAfterWin).toBe(false);

  let gameId = payload.id as string;
  let current = payload.current as GameState;
  let recoverySnapshot = payload.recoverySnapshot as SessionRecoverySnapshot;
  const priority: Dir[] = ["left", "down", "right", "up"];

  for (let moveCount = 0; moveCount < 500 && !current.over && !current.won; moveCount += 1) {
    const dir = priority.find((candidate) => applyMove(current, candidate).moved);
    expect(dir, "unfinished game must have a legal move").toBeTruthy();
    const moveResponse = await request.post(`/api/games/${gameId}/move`, {
      headers: { authorization: `Bearer ${bridgeToken}` },
      data: { dir, recoverySnapshot }
    });
    expect(moveResponse.status()).toBe(200);
    expect(moveResponse.headers()["ratelimit-scope"]).toBe("account");
    expect(moveResponse.headers()["ratelimit-tier"]).toBe(payload.economy.userTier);
    expect(Number(moveResponse.headers()["ratelimit-limit"])).toBe(
      payload.economy.userTier === "paid" ? 1800 : 600
    );
    const moved = await moveResponse.json();
    gameId = moved.id;
    current = moved.current;
    recoverySnapshot = moved.recoverySnapshot;
  }

  expect(current.over || current.won).toBe(true);
  const submission = await request.post("/api/leaderboard/submit", {
    headers: { authorization: `Bearer ${bridgeToken}` },
    data: {
      gameId,
      recoverySnapshot,
      isPractice: true
    }
  });
  expect(submission.status()).toBe(200);
  const submitted = await submission.json();
  expect(submitted).toMatchObject({
    submitted: true,
    storedNamespace: "sandbox",
    entry: {
      namespace: "sandbox",
      isPractice: true,
      gameId
    }
  });
  expect(submitted.entry.playerId).toEqual(expect.any(String));
  expect(submitted.entry.playerId.length).toBeGreaterThan(0);
});

test("authenticated store reads are account-bound and paid mutations fail closed", async ({ page, request }) => {
  expect(bridgeToken).toBeTruthy();

  const catalogResponse = await request.get("/api/store/catalog");
  expect(catalogResponse.status()).toBe(200);
  const catalog = await catalogResponse.json();
  expect(Array.isArray(catalog.packets)).toBe(true);
  expect(catalog.packets.length).toBeGreaterThan(0);

  const unauthenticatedInventory = await request.get("/api/store/inventory");
  expect(unauthenticatedInventory.status()).toBe(401);

  const inventoryResponse = await request.get("/api/store/inventory?limit=5", {
    headers: { authorization: `Bearer ${bridgeToken}` }
  });
  expect(inventoryResponse.status()).toBe(200);
  const inventory = await inventoryResponse.json();
  expect(inventory.userTier).toBe(bridgeUserTier);
  expect(inventory.inventory?.subscriberId).toMatch(/^acct_[a-f0-9]{64}$/);
  expect(inventory.inventory?.balances).toEqual(
    expect.objectContaining({ undo_charge: expect.any(Number) })
  );

  const crossAccountRead = await request.get(
    "/api/store/inventory?subscriberId=another-account",
    { headers: { authorization: `Bearer ${bridgeToken}` } }
  );
  expect(crossAccountRead.status()).toBe(403);

  const unauthorizedGrant = await request.post("/api/store/inventory", {
    headers: { authorization: `Bearer ${bridgeToken}` },
    data: { subscriberId: inventory.inventory.subscriberId, sku: "undo_charge", quantity: 1 }
  });
  expect(unauthorizedGrant.status()).toBe(401);

  const directPurchase = await request.post("/api/store/purchase", {
    headers: { authorization: `Bearer ${bridgeToken}` },
    data: { packetSku: "pack_undo_starter", quantity: 1 }
  });
  expect(directPurchase.status()).toBe(503);

  await page.goto("/store");
  await expect(page.getByText("Account inventory loaded.")).toBeVisible();
  await expect(
    page.getByText(
      bridgeUserTier === "paid"
        ? "Paid-tier store actions are enabled."
        : "Paid store actions require a paid tier session."
    )
  ).toBeVisible();
});
