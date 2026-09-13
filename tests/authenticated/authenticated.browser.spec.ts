import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

let bridgeToken = "";

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

test("real authenticated identity can create a ranked session with an account quota", async ({ request }) => {
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

  const moveResponse = await request.post(`/api/games/${payload.id}/move`, {
    headers: { authorization: `Bearer ${bridgeToken}` },
    data: { dir: "left", recoverySnapshot: payload.recoverySnapshot }
  });
  expect(moveResponse.status()).toBe(200);
  expect(moveResponse.headers()["ratelimit-scope"]).toBe("account");
  expect(moveResponse.headers()["ratelimit-tier"]).toBe(payload.economy.userTier);
  expect(Number(moveResponse.headers()["ratelimit-limit"])).toBe(
    payload.economy.userTier === "paid" ? 1800 : 600
  );
});
