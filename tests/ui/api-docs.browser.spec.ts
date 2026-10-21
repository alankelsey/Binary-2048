import { expect, test } from "@playwright/test";

test("API explorer filters and expands the canonical contract", async ({ page }) => {
  await page.goto("/api-docs");

  await expect(page.getByRole("heading", { name: "Interactive explorer" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Filter paths and operations" }).fill("ingest");
  await expect(page.getByRole("status").filter({ hasText: "operations shown" })).toHaveText("1 operations shown");

  const operation = page.locator("details").filter({ hasText: "Ingest canonical run records" });
  await operation.locator("summary").click();
  await expect(operation).toContainText("Request body: documented");
  await expect(operation).toContainText("400 A non-empty records array is required");

  await page.getByRole("searchbox", { name: "Filter paths and operations" }).fill("no-such-operation");
  await expect(page.getByText("No API operations match this filter.")).toBeVisible();
});
