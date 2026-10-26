import { expect, test } from "@playwright/test";

test("places, replaces, erases, undoes, redoes, and resets with accessible controls", async ({ page }) => {
  await page.goto("/scenario-builder");

  const palette = page.getByRole("toolbar", { name: "Tile palette" });
  const firstCell = page.getByRole("gridcell", { name: "Row 1, column 1, Empty" });
  await palette.getByRole("button", { name: "2 Number 2" }).click();
  await firstCell.click();
  await expect(page.getByRole("gridcell", { name: "Row 1, column 1, Number 2" })).toBeVisible();

  await palette.getByRole("button", { name: "Lock-0 Lock-0" }).click();
  await page.getByRole("gridcell", { name: "Row 1, column 1, Number 2" }).press("Enter");
  await expect(page.getByRole("gridcell", { name: "Row 1, column 1, Lock-0" })).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("gridcell", { name: "Row 1, column 1, Number 2" })).toBeVisible();
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByRole("gridcell", { name: "Row 1, column 1, Lock-0" })).toBeVisible();

  await palette.getByRole("button", { name: "Erase Empty" }).click();
  await page.getByRole("gridcell", { name: "Row 1, column 1, Lock-0" }).click();
  await expect(page.getByRole("gridcell", { name: "Row 1, column 1, Empty" })).toBeVisible();

  await palette.getByRole("button", { name: "4 Number 4" }).click();
  await page.getByRole("gridcell", { name: "Row 2, column 2, Empty" }).click();
  await page.getByRole("button", { name: "Reset board" }).click();
  await expect(page.getByRole("gridcell", { name: "Row 2, column 2, Empty" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
});

test("paints across cells with a pointer drag", async ({ page }) => {
  await page.goto("/scenario-builder");
  await page.getByRole("toolbar", { name: "Tile palette" }).getByRole("button", { name: "0 Zero" }).click();

  const first = page.getByRole("gridcell", { name: "Row 1, column 1, Empty" });
  const second = page.getByRole("gridcell", { name: "Row 1, column 2, Empty" });
  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  if (!firstBox || !secondBox) throw new Error("Scenario cells must be visible");

  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, { steps: 4 });
  await page.mouse.up();

  await expect(page.getByRole("gridcell", { name: "Row 1, column 1, Zero" })).toBeVisible();
  await expect(page.getByRole("gridcell", { name: "Row 1, column 2, Zero" })).toBeVisible();
});
