import { expect, test } from "@playwright/test";

test("keeps every cosmetic cue legible at a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/cosmetic-proof");

  const proof = page.getByRole("region", { name: "Workbench cosmetic asset proof" });
  await expect(proof).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(4);
  await expect(page.getByRole("listitem", { name: "number tile" }).getByText("2048")).toBeVisible();
  await expect(page.getByRole("listitem", { name: "zero: ring cue" }).getByText("0")).toBeVisible();
  await expect(page.getByRole("listitem", { name: "wildcard: star cue" }).getByText("WILD")).toBeVisible();
  await expect(page.getByRole("listitem", { name: "locked zero: lock cue" }).getByText("LOCK 0")).toBeVisible();
  expect(await proof.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test("reflows at the 160px effective viewport produced by 200% zoom", async ({ page }) => {
  await page.setViewportSize({ width: 160, height: 720 });
  await page.goto("/cosmetic-proof");

  const proof = page.getByRole("region", { name: "Workbench cosmetic asset proof" });
  expect(await proof.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(page.getByText("LOCK 0", { exact: true })).toBeVisible();
});

test("uses the static animation fallback when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/cosmetic-proof");

  const effect = page.locator(".cosmetic-animation-effect");
  await expect(effect).toHaveCSS("animation-name", "none");
  await expect(effect).toHaveCSS("opacity", "0.28");
});
