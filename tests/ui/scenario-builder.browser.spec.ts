import { expect, test } from "@playwright/test";

test("places, replaces, erases, undoes, redoes, and resets with accessible controls", async ({ page }) => {
  await page.goto("/scenario-builder");

  const palette = page.getByRole("toolbar", { name: "Tile palette" });
  const board = page.getByRole("grid", { name: "4 by 4 scenario board" });
  const firstCell = board.getByRole("gridcell", { name: "Row 1, column 1, Empty" });
  await palette.getByRole("button", { name: "Number 2", exact: true }).click();
  await firstCell.click();
  await expect(board.getByRole("gridcell", { name: "Row 1, column 1, Number 2" })).toBeVisible();

  await palette.getByRole("button", { name: "Lock-0", exact: true }).click();
  await board.getByRole("gridcell", { name: "Row 1, column 1, Number 2" }).press("Enter");
  await expect(board.getByRole("gridcell", { name: "Row 1, column 1, Lock-0" })).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(board.getByRole("gridcell", { name: "Row 1, column 1, Number 2" })).toBeVisible();
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(board.getByRole("gridcell", { name: "Row 1, column 1, Lock-0" })).toBeVisible();

  await palette.getByRole("button", { name: "Empty", exact: true }).click();
  await board.getByRole("gridcell", { name: "Row 1, column 1, Lock-0" }).click();
  await expect(board.getByRole("gridcell", { name: "Row 1, column 1, Empty" })).toBeVisible();

  await palette.getByRole("button", { name: "Number 4", exact: true }).click();
  await board.getByRole("gridcell", { name: "Row 2, column 2, Empty" }).click();
  await page.getByRole("button", { name: "Reset board" }).click();
  await expect(board.getByRole("gridcell", { name: "Row 2, column 2, Empty" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
});

test("paints across cells with a pointer drag", async ({ page }) => {
  await page.goto("/scenario-builder");
  await page.getByRole("toolbar", { name: "Tile palette" }).getByRole("button", { name: "Zero", exact: true }).click();

  const board = page.getByRole("grid", { name: "4 by 4 scenario board" });
  const first = board.getByRole("gridcell", { name: "Row 1, column 1, Empty" });
  const second = board.getByRole("gridcell", { name: "Row 1, column 2, Empty" });
  await first.scrollIntoViewIfNeeded();
  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  if (!firstBox || !secondBox) throw new Error("Scenario cells must be visible");

  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, { steps: 4 });
  await page.mouse.up();

  await expect(board.getByRole("gridcell", { name: "Row 1, column 1, Zero" })).toBeVisible();
  await expect(board.getByRole("gridcell", { name: "Row 1, column 2, Zero" })).toBeVisible();
});

test("applies every symmetry mode as one announced, undoable board edit", async ({ page }) => {
  await page.goto("/scenario-builder");

  const palette = page.getByRole("toolbar", { name: "Tile palette" });
  const symmetry = page.getByRole("toolbar", { name: "Placement symmetry" });
  const announcement = page.locator(".scenario-announcement");
  const board = page.getByRole("grid", { name: "4 by 4 scenario board" });

  await palette.getByRole("button", { name: "Number 2", exact: true }).click();
  await symmetry.getByRole("button", { name: "Horizontal mirror, left and right", exact: true }).click();
  await board.getByRole("gridcell", { name: "Row 1, column 1, Empty" }).click();
  await expect(board.getByRole("gridcell", { name: "Row 1, column 4, Number 2" })).toBeVisible();
  await expect(announcement).toHaveText(
    "Row 1, column 1; row 1, column 4 changed to Number 2"
  );

  await palette.getByRole("button", { name: "Number 4", exact: true }).click();
  await symmetry.getByRole("button", { name: "Vertical mirror, top and bottom", exact: true }).click();
  await board.getByRole("gridcell", { name: "Row 1, column 2, Empty" }).click();
  await expect(board.getByRole("gridcell", { name: "Row 4, column 2, Number 4" })).toBeVisible();

  await palette.getByRole("button", { name: "Zero", exact: true }).click();
  await symmetry.getByRole("button", { name: "180 degree rotation", exact: true }).click();
  await board.getByRole("gridcell", { name: "Row 2, column 1, Empty" }).click();
  await expect(board.getByRole("gridcell", { name: "Row 3, column 4, Zero" })).toBeVisible();

  await palette.getByRole("button", { name: "Lock-0", exact: true }).click();
  const fourWay = symmetry.getByRole("button", { name: "Four-way symmetry", exact: true });
  await fourWay.click();
  await expect(fourWay).toHaveAttribute("aria-pressed", "true");
  await board.getByRole("gridcell", { name: "Row 2, column 2, Empty" }).click();
  for (const name of [
    "Row 2, column 2, Lock-0",
    "Row 2, column 3, Lock-0",
    "Row 3, column 2, Lock-0",
    "Row 3, column 3, Lock-0"
  ]) {
    await expect(board.getByRole("gridcell", { name })).toBeVisible();
  }
  await expect(announcement).toHaveText(
    "Row 2, column 2; row 2, column 3; row 3, column 2; row 3, column 3 changed to Lock-0"
  );

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  for (const name of [
    "Row 2, column 2, Empty",
    "Row 2, column 3, Empty",
    "Row 3, column 2, Empty",
    "Row 3, column 3, Empty"
  ]) {
    await expect(board.getByRole("gridcell", { name })).toBeVisible();
  }
});

test("reports scenario validity and legal moves as the board and configuration change", async ({ page }) => {
  await page.goto("/scenario-builder");

  const validation = page.getByRole("region", { name: "Validation" });
  const previews = page.getByRole("region", { name: "Move previews" });
  const board = page.getByRole("grid", { name: "4 by 4 scenario board" });
  await expect(validation).toContainText("Board must have at least one legal move.");
  await expect(previews).toContainText("Resolve validation errors to preview legal moves.");

  await page.getByRole("toolbar", { name: "Tile palette" })
    .getByRole("button", { name: "Number 2", exact: true })
    .click();
  await board.getByRole("gridcell", { name: "Row 1, column 1, Empty" }).click();
  await expect(validation).toContainText("Scenario ready. Legal moves: down, right.");
  await expect(previews).toContainText("2 deterministic legal move previews. Each board includes its seeded spawn.");
  await expect(previews.getByRole("article")).toHaveCount(2);
  await expect(previews.getByRole("article", { name: "Down move preview" })).toContainText(/Score \+0; .+ spawns at row \d, column \d/);
  await expect(previews.getByRole("grid", { name: "Board after down move" }).getByRole("gridcell")).toHaveCount(16);
  await expect(previews.getByRole("grid", { name: "Board after right move" }).getByRole("gridcell")).toHaveCount(16);

  await page.getByRole("spinbutton", { name: "One" }).fill("0.5");
  await expect(validation).toContainText("Spawn probabilities must total 1.");
  await expect(previews.getByRole("article")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Wildcard multipliers" }).fill("3");
  await expect(validation).toContainText("Wildcard multipliers must be powers of two of at least 2.");
});

test("saves, reloads, restores, and deletes a named local draft", async ({ page }) => {
  await page.goto("/scenario-builder");
  const palette = page.getByRole("toolbar", { name: "Tile palette" });
  let board = page.getByRole("grid", { name: "4 by 4 scenario board" });

  await page.getByRole("textbox", { name: "Draft name" }).fill("Corner opening");
  await palette.getByRole("button", { name: "Number 4", exact: true }).click();
  await board.getByRole("gridcell", { name: "Row 1, column 1, Empty" }).click();
  await page.getByRole("button", { name: "Save locally" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Corner opening saved locally." })).toBeVisible();

  await page.reload();
  board = page.getByRole("grid", { name: "4 by 4 scenario board" });
  await expect(page.getByRole("button", { name: "Load local draft Corner opening" })).toBeVisible();
  await page.getByRole("toolbar", { name: "Tile palette" }).getByRole("button", { name: "Zero", exact: true }).click();
  await board.getByRole("gridcell", { name: "Row 1, column 1, Empty" }).click();
  await page.getByRole("button", { name: "Load local draft Corner opening" }).click();
  await expect(board.getByRole("gridcell", { name: "Row 1, column 1, Number 4" })).toBeVisible();

  await page.getByRole("button", { name: "Delete local draft Corner opening" }).click();
  await expect(page.getByText("No local drafts.", { exact: true })).toBeVisible();
});

test.describe("mobile touch and screen-reader announcements", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("announces palette selection and each cell changed by a touch drag", async ({ page }) => {
    await page.goto("/scenario-builder");

    const palette = page.getByRole("toolbar", { name: "Tile palette" });
    const announcement = page.locator(".scenario-announcement");
    const board = page.getByRole("grid", { name: "4 by 4 scenario board" });
    await expect(announcement).toHaveAttribute("role", "status");
    await expect(announcement).toHaveAttribute("aria-live", "polite");
    await expect(announcement).toHaveAttribute("aria-atomic", "true");
    await announcement.evaluate((node) => {
      const observed: string[] = [];
      new MutationObserver(() => {
        if (node.textContent) observed.push(node.textContent);
      }).observe(node, { childList: true, characterData: true, subtree: true });
      (window as Window & { __scenarioAnnouncements?: string[] }).__scenarioAnnouncements = observed;
    });

    const numberEight = palette.getByRole("button", { name: "Number 8", exact: true });
    await numberEight.tap();
    await expect(numberEight).toHaveAttribute("aria-pressed", "true");
    await expect(announcement).toHaveText("Number 8 selected");
    const paletteTarget = await numberEight.boundingBox();
    expect(paletteTarget?.width).toBeGreaterThanOrEqual(44);
    expect(paletteTarget?.height).toBeGreaterThanOrEqual(44);

    const first = board.getByRole("gridcell", { name: "Row 1, column 1, Empty" });
    const second = board.getByRole("gridcell", { name: "Row 1, column 2, Empty" });
    await first.scrollIntoViewIfNeeded();
    const firstBox = await first.boundingBox();
    const secondBox = await second.boundingBox();
    if (!firstBox || !secondBox) throw new Error("Scenario cells must be visible");

    const client = await page.context().newCDPSession(page);
    const firstPoint = { x: firstBox.x + firstBox.width / 2, y: firstBox.y + firstBox.height / 2 };
    const secondPoint = { x: secondBox.x + secondBox.width / 2, y: secondBox.y + secondBox.height / 2 };
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...firstPoint, id: 1 }]
    });
    await page.waitForTimeout(50);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...secondPoint, id: 1 }]
    });
    await page.waitForTimeout(50);
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

    await expect(board.getByRole("gridcell", { name: "Row 1, column 1, Number 8" })).toBeVisible();
    await expect(board.getByRole("gridcell", { name: "Row 1, column 2, Number 8" })).toBeVisible();
    await expect(announcement).toHaveText("Row 1, column 2 changed to Number 8");
    const observedAnnouncements = await page.evaluate(() =>
      (window as Window & { __scenarioAnnouncements?: string[] }).__scenarioAnnouncements
    );
    expect(observedAnnouncements).toEqual([
      "Number 8 selected",
      "Row 1, column 1 changed to Number 8",
      "Row 1, column 2 changed to Number 8"
    ]);

    const accessibilityTree = await client.send("Accessibility.getFullAXTree");
    const announcementTextNode = accessibilityTree.nodes.find((node) =>
      node.name?.value === "Row 1, column 2 changed to Number 8"
    );
    const liveAnnouncement = accessibilityTree.nodes.find((node) =>
      node.role?.value === "status" && (
        node.name?.value === "Row 1, column 2 changed to Number 8" ||
        node.childIds?.includes(announcementTextNode?.nodeId ?? "")
      )
    );
    expect(liveAnnouncement).toBeDefined();
    expect(liveAnnouncement?.properties?.some((property) =>
      property.name === "live" && property.value.value === "polite"
    )).toBe(true);
    expect(liveAnnouncement?.properties?.some((property) =>
      property.name === "atomic" && property.value.value === true
    )).toBe(true);
  });

  test("keeps concise names and announces keyboard editing history", async ({ page }) => {
    await page.goto("/scenario-builder");

    const announcement = page.locator(".scenario-announcement");
    const board = page.getByRole("grid", { name: "4 by 4 scenario board" });
    const wildcard = page.getByRole("toolbar", { name: "Tile palette" })
      .getByRole("button", { name: "Wildcard times 2", exact: true });
    await wildcard.focus();
    await wildcard.press("Enter");
    await expect(announcement).toHaveText("Wildcard times 2 selected");

    const cell = board.getByRole("gridcell", { name: "Row 1, column 1, Empty" });
    await cell.focus();
    await cell.press("Enter");
    await expect(announcement).toHaveText("Row 1, column 1 changed to Wildcard times 2");

    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(announcement).toHaveText("Last board change undone");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(announcement).toHaveText("Last board change redone");

    const paletteNames = await page.getByRole("toolbar", { name: "Tile palette" })
      .getByRole("button")
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
    expect(paletteNames).toContain("Empty");
    expect(paletteNames).toContain("Number 2");
    expect(paletteNames).toContain("Zero");
    expect(paletteNames).toContain("Wildcard times 2");
    expect(paletteNames).toContain("Lock-0");
  });
});
