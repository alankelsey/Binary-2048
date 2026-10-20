import { expect, test } from "@playwright/test";

test("advanced help loads only when expanded and announces its loading state", async ({ page }) => {
  const helpChunks: string[] = [];
  await page.route("**/_next/static/chunks/**", async (route) => {
    if (!route.request().url().includes("advanced-help-body")) return route.continue();
    helpChunks.push(route.request().url());
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.continue();
  });

  await page.goto("/");
  expect(helpChunks).toHaveLength(0);
  await page.getByText("How to play:", { exact: false }).click();
  await expect(page.getByText("Loading game help…", { exact: true })).toBeVisible();
  await expect(page.getByText("Basic moves: all tiles slide in one direction per turn.")).toBeVisible();
  expect(helpChunks).toHaveLength(1);
});

test("advanced help exposes a retry after a chunk-load failure", async ({ page }) => {
  let attempts = 0;
  await page.route("**/_next/static/chunks/**", async (route) => {
    if (!route.request().url().includes("advanced-help-body")) return route.continue();
    attempts += 1;
    if (attempts === 1) return route.abort("failed");
    await route.continue();
  });

  await page.goto("/");
  await page.getByText("How to play:", { exact: false }).click();
  await expect(page.getByText("Game help could not be loaded.")).toBeVisible();
  await page.getByRole("button", { name: "Retry help" }).click();
  await expect(page.getByText("Basic moves: all tiles slide in one direction per turn.")).toBeVisible();
  expect(attempts).toBe(2);
});
