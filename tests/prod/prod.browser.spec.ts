import { expect, test } from "@playwright/test";

test("prod home renders core app shell", async ({ page }) => {
  const response = await page.goto("/");
  expect(response).toBeTruthy();
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Binary 2048" })).toBeVisible();
});

test("prod auth page renders and does not show server configuration error", async ({ page }) => {
  const response = await page.goto("/auth");
  expect(response).toBeTruthy();
  expect(response?.status()).toBe(200);
  await expect(page.getByText("There is a problem with the server configuration.")).toHaveCount(0);
});

test("prod auth/session APIs are healthy from browser context", async ({ page, request }) => {
  await page.goto("/");

  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  const healthJson = await health.json();
  expect(healthJson.ok).toBe(true);

  const providers = await request.get("/api/auth/providers");
  expect(providers.status()).toBe(200);
  const providerJson = await providers.json();
  expect(Object.keys(providerJson)).toContain("github");
});
