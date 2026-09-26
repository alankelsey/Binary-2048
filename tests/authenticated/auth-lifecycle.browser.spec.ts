import { expect, test } from "@playwright/test";

async function expectProtectedGuestState(page: import("@playwright/test").Page) {
  await page.goto("/privacy");
  await expect(page.locator(".auth-shell")).toHaveAttribute("data-authenticated", "false");
  await expect(page.getByText("Sign in to use account data export/delete endpoints.")).toBeVisible();

  const bridgeStatus = await page.evaluate(async () => {
    const response = await fetch("/api/auth/bridge-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ttlSeconds: 300 })
    });
    return response.status;
  });
  expect(bridgeStatus).toBe(401);
}

test("sign-out clears the real desktop session and restores protected guest messaging", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByText("Authenticated: yes")).toBeVisible();

  await page.getByRole("main").getByRole("link", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/$/);

  await expectProtectedGuestState(page);
});

test("an expired desktop session fails closed and can reach the sign-in recovery path", async ({ page, context }) => {
  const sessionCookie = (await context.cookies()).find((cookie) =>
    cookie.name.endsWith("session-token")
  );
  expect(sessionCookie, "captured OAuth state must contain a session cookie").toBeTruthy();

  await context.addCookies([{
    ...sessionCookie!,
    expires: Math.floor(Date.now() / 1000) - 60
  }]);

  await expectProtectedGuestState(page);
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/api\/auth\/signin/);
  await expect(page.getByRole("button", { name: /Sign in with (GitHub|Google)/ })).toBeVisible();
});

test("a signed-out desktop session can reauthenticate through the real GitHub provider", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/auth");
  await expect(page.getByText("Authenticated: yes")).toBeVisible();

  await page.getByRole("main").getByRole("link", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/$/);
  await expect(page.locator(".auth-shell")).toHaveAttribute("data-authenticated", "false");

  await page.getByLabel("Authentication status").getByRole("link", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Sign in with GitHub" }).click();
  await page.waitForURL((url) =>
    url.origin === "https://www.binary2048.com" && !url.pathname.startsWith("/api/auth"),
    { timeout: 45_000 }
  );

  await page.goto("/auth");
  await expect(page.getByText("Authenticated: yes")).toBeVisible();
  await expect(page.getByText(/Tier: (authed|paid)/)).toBeVisible();
  const bridgeStatus = await page.evaluate(async () => {
    const response = await fetch("/api/auth/bridge-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ttlSeconds: 300 })
    });
    return response.status;
  });
  expect(bridgeStatus).toBe(200);
});
