import { expect, test } from "@playwright/test";

test("How to Play documents shipped tile rules without advertising unavailable store products", async ({ page }) => {
  await page.goto("/");

  const summary = page.getByText(/^How to play:/);
  const howToPlay = summary.locator("..");
  await summary.click();

  await expect(howToPlay).toContainText("Lock-0");
  await expect(howToPlay).toContainText("Wildcard tiles");
  await expect(howToPlay.getByLabel("store icon legend")).toHaveCount(0);
  await expect(howToPlay).not.toContainText("Jam Tile");
  await expect(howToPlay).not.toContainText("Grid Skin");
  await expect(howToPlay).not.toContainText("Theme Pack");
  await expect(howToPlay).not.toContainText("Undo Charge");
});
