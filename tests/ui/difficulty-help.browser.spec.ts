import { expect, test, type Page } from "@playwright/test";

// Difficulty-help disclosure coverage (docs/mobile-ui-accessibility-audit-2026-09-15.md
// finding #6, docs/roadmap-checklist.md "Replace the title-only difficulty
// help with a keyboard- and touch-accessible visible disclosure"). Local UI
// regression suite — see tests/ui/mobile-dock.browser.spec.ts for the same
// page.route + engine mocking convention and why this lives in tests/ui
// (run via `npm run test:ui`, playwright.ui.config.ts) rather than
// tests/prod.
//
async function openDifficultyOptions(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.localStorage.removeItem("binary2048.currentGameId");
    window.localStorage.removeItem("binary2048.resumeSnapshot");
  });
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "NEW GAME" })).toBeVisible();
}

test.describe("difficulty help disclosure", () => {
  test("new-game setup exposes the difficulty select and help button", async ({ page }) => {
    await openDifficultyOptions(page);
    await expect(page.locator("#new-game-difficulty")).toBeVisible();
    await expect(page.getByRole("button", { name: "Show difficulty help" })).toBeVisible();
  });

  test("the help button is keyboard focusable and Enter opens the note, updating aria-expanded", async ({ page }) => {
    await openDifficultyOptions(page);
    // Locate by the stable class rather than the accessible name: the name
    // itself flips between "Show difficulty help" and "Hide difficulty
    // help" as it toggles.
    await expect(page.getByRole("button", { name: "Show difficulty help" })).toBeVisible();
    const helpButton = page.locator(".field-help");

    await helpButton.focus();
    await expect(helpButton).toBeFocused();
    await expect(helpButton).toHaveAttribute("aria-expanded", "false");

    await page.keyboard.press("Enter");
    await expect(helpButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "Hide difficulty help" })).toBeVisible();
  });

  test("Space also opens the note while the button is focused", async ({ page }) => {
    await openDifficultyOptions(page);
    const helpButton = page.locator(".field-help");

    await helpButton.focus();
    await page.keyboard.press("Space");
    await expect(helpButton).toHaveAttribute("aria-expanded", "true");
  });

  test("clicking the help button opens visible help text associated through aria-controls, and the accessible name flips", async ({
    page
  }) => {
    await openDifficultyOptions(page);
    const helpButton = page.locator(".field-help");

    await helpButton.click();
    await expect(helpButton).toHaveAttribute("aria-expanded", "true");

    const controlsId = await helpButton.getAttribute("aria-controls");
    expect(controlsId).toBe("difficulty-help-note");

    const note = page.locator(`#${controlsId}`);
    await expect(note).toBeVisible();
    await expect(note).toHaveAttribute("role", "note");
    await expect(note).toContainText(/Difficulty changes wildcard\/lock spawn rates/);

    await expect(page.getByRole("button", { name: "Hide difficulty help" })).toBeVisible();
  });

  test("Escape closes the note and returns aria-expanded to false", async ({ page }) => {
    await openDifficultyOptions(page);
    const helpButton = page.locator(".field-help");

    await helpButton.click();
    await expect(helpButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#difficulty-help-note")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(helpButton).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#difficulty-help-note")).toHaveCount(0);
  });

  test("tapping the help button opens the note (touch support)", async ({ page }) => {
    await openDifficultyOptions(page);
    const helpButton = page.locator(".field-help");

    await helpButton.dispatchEvent("click");
    await expect(helpButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#difficulty-help-note")).toBeVisible();
  });

  test("the difficulty select has an explicit label association and is not nested inside the help button's label", async ({
    page
  }) => {
    await openDifficultyOptions(page);
    const select = page.locator("#new-game-difficulty");
    const labelledBy = await select.getAttribute("aria-labelledby");
    expect(labelledBy).toBe("new-game-difficulty-label");
    await expect(page.locator(`#${labelledBy}`)).toHaveText("Difficulty");

    // The help button must not be a descendant of a <label> that also wraps
    // the select (that would make clicking the button forward activation to
    // the select) — it should be a plain sibling.
    const helpInLabel = await page.locator("label:has(.field-help)").count();
    expect(helpInLabel).toBe(0);
  });
});
