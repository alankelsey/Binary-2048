import { expect, test } from "@playwright/test";

test("game shell becomes usable while authentication is still pending", async ({ page }) => {
  await page.route("**/api/auth/session", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 750));
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start New Game" })).toBeVisible();
  await expect(page.getByText("Checking account…", { exact: true })).toBeVisible();
  const marks = await page.evaluate(() => ({
    shell: performance.getEntriesByName("binary2048:game-shell-ready").length,
    authComplete: performance.getEntriesByName("binary2048:auth-hydration-complete").length
  }));
  expect(marks).toEqual({ shell: 1, authComplete: 0 });
  await expect(page.locator(".auth-shell")).toHaveAttribute("data-auth-state", "ready");
  await expect.poll(() => page.evaluate(() => performance.getEntriesByName("binary2048:auth-hydration-complete").length)).toBe(1);
  const separationMs = await page.evaluate(() =>
    performance.getEntriesByName("binary2048:auth-hydration-complete")[0].startTime -
    performance.getEntriesByName("binary2048:game-shell-ready")[0].startTime
  );
  expect(separationMs).toBeGreaterThanOrEqual(500);
  await expect(page.locator('button:has-text("Import JSON")')).toHaveCount(0);
});

test("authenticated controls appear only after a positive session response", async ({ page }) => {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { name: "Support Player", email: "player@example.test" }, tier: "authed" })
    });
  });

  await page.goto("/");
  await expect(page.locator(".auth-shell")).toHaveAttribute("data-authenticated", "true");
  await expect(page.getByText("Support Player")).toBeVisible();
  await expect(page.locator('button:has-text("Import JSON")')).toHaveCount(1);
});

test("failed authentication stays fail closed and offers a retry", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/auth/session", async (route) => {
    requests += 1;
    if (requests === 1) {
      await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto("/");
  await expect(page.getByText("Account status unavailable.", { exact: true })).toBeVisible();
  await expect(page.locator(".auth-shell")).toHaveAttribute("data-authenticated", "false");
  await expect(page.locator('button:has-text("Import JSON")')).toHaveCount(0);
  await page.getByLabel("Authentication status").getByRole("button", { name: "Retry" }).click();
  await expect(page.locator(".auth-shell")).toHaveAttribute("data-auth-state", "ready");
  await expect(page.getByLabel("Authentication status").getByRole("link", { name: /Sign in|Auth setup/ })).toBeVisible();
});

test("an empty expired-session response resolves to guest controls", async ({ page }) => {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.goto("/");
  await expect(page.locator(".auth-shell")).toHaveAttribute("data-auth-state", "ready");
  await expect(page.locator(".auth-shell")).toHaveAttribute("data-authenticated", "false");
  await expect(page.getByLabel("Authentication status").getByRole("link", { name: /Sign in|Auth setup/ })).toBeVisible();
});
