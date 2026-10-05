import { expect, test } from "@playwright/test";

test.use({ trace: "off", screenshot: "off", video: "off" });
test.skip(process.env.AUTH_OPS_ACCEPTANCE !== "1", "Requires the named operator's real OAuth session.");

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`operator console is readable and keyboard accessible at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/ops");
    const main = page.locator("main.ops");
    await expect(main.getByRole("heading", { name: "Operations", exact: true })).toBeVisible();
    await expect(main.getByText("Read-only · Shared data", { exact: true })).toBeVisible();
    for (const name of ["Storage configuration", "Selected API activity", "League configuration", "Model registry", "Leaderboard"]) {
      await expect(main.getByRole("region", { name, exact: true })).toBeVisible();
    }
    await expect(main.getByRole("alert")).toHaveCount(0);
    await expect(main.getByText(/Updated /)).toBeVisible();
    const table = main.getByRole("region", { name: "API activity table", exact: true });
    await expect(table.getByRole("columnheader")).toHaveCount(4);
    await expect(main.getByRole("button")).toHaveCount(0);
    const refresh = main.getByRole("link", { name: "Refresh data" });
    await refresh.focus();
    await expect(refresh).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(table).toBeFocused();
    expect(await table.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await refresh.click();
    await expect(main.getByText("Read-only · Shared data", { exact: true })).toBeVisible();
  });
}

test("anonymous browser cannot read the operator console", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    const page = await context.newPage();
    await page.goto("/ops");
    await expect(page.getByText("Operator access required.", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Storage configuration" })).toHaveCount(0);
    const response = await context.request.get("/api/ops/storage/status");
    expect(response.status()).toBe(401);
  } finally {
    await context.close();
  }
});
