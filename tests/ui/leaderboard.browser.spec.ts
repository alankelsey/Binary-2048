import { expect, test } from "@playwright/test";

// Leaderboard presentation coverage (docs/mobile-ui-accessibility-audit-2026-09-15.md,
// docs/roadmap-checklist.md "Ship the semantic, responsive leaderboard
// presentation that replaces raw JSON"). This is a local UI regression
// suite, not a production synthetic — it lives in tests/ui and runs via
// `npm run test:ui` (see playwright.ui.config.ts), against a local dev
// server (default baseURL http://localhost:3000, override with UI_BASE).
//
// app/leaderboard/page.tsx is a Server Component that reads directly from
// the in-memory leaderboard/daily-challenge stores (lib/binary2048/leaderboard.ts,
// daily-challenge.ts) — there is no client-side fetch for page.route to
// intercept. Getting a *real* populated store requires a real ranked
// session (auth + an actual completed game through /api/games and
// /api/games/:id/move) and a real leaderboard submission, which is
// explicitly out of scope for this UI-focused pass (see the audit doc).
//
// So: the empty/active-tab/sandbox-banner/focus tests below exercise the
// real page against a real (naturally empty, in-memory) server — no
// mocking needed. The "populated" tests are stylesheet/layout fixtures,
// NOT component-rendering tests: they inject markup built to the same
// contract RankedTable/DailyTable emit (see app/leaderboard-view.tsx,
// mirrored here) into the real page via page.evaluate, so the *rendered
// CSS/layout/horizontal-scroll behavior* get exercised in a real browser
// against the real stylesheet. They do not import, render, or otherwise
// exercise the real RankedTable/DailyTable JSX — that coverage now lives in
// lib/binary2048/leaderboard-view.test.tsx (react-dom/server
// renderToStaticMarkup against the actual components). The per-cell
// formatting logic those components rely on (rank classing, tier labels,
// timestamp/id formatting) has its own direct unit coverage in
// lib/binary2048/leaderboard-view-format.test.ts. If app/leaderboard-view.tsx's
// markup contract changes, this fixture needs updating to match.

const RANKED_FIXTURE_ROWS = [
  { rank: 1, tier: "authed", tierLabel: "Player", playerId: "player_alpha", score: 2048, maxTile: 1024, moves: 120 },
  { rank: 2, tier: "paid", tierLabel: "Pro", playerId: "player_beta", score: 1024, maxTile: 512, moves: 98 },
  { rank: 3, tier: "guest", tierLabel: "Guest", playerId: "player_gamma_extra_long_id", score: 512, maxTile: 256, moves: 64 }
];

function buildRankedTableHtml(): string {
  const rows = RANKED_FIXTURE_ROWS.map(
    (row) => `
      <tr>
        <td class="leaderboard-rank top-${row.rank}">#${row.rank}</td>
        <td>
          <span class="leaderboard-player">
            <span class="auth-tier auth-tier-${row.tier}">${row.tierLabel}</span>
            <span class="leaderboard-player-id">${row.playerId.length > 14 ? `${row.playerId.slice(0, 6)}…${row.playerId.slice(-4)}` : row.playerId}</span>
          </span>
        </td>
        <td class="num leaderboard-score">${row.score.toLocaleString("en-US")}</td>
        <td class="num">${row.maxTile.toLocaleString("en-US")}</td>
        <td class="num">${row.moves.toLocaleString("en-US")}</td>
        <td class="meta-text">2026-09-15 12:00 UTC</td>
      </tr>`
  ).join("");
  return `
    <div class="leaderboard-table-wrap">
      <table class="leaderboard-table">
        <caption class="sr-only">Ranked leaderboard standings</caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Player</th>
            <th scope="col" class="num">Score</th>
            <th scope="col" class="num">Max tile</th>
            <th scope="col" class="num">Moves</th>
            <th scope="col">Submitted</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function buildDailyTableHtml(): string {
  const rows = RANKED_FIXTURE_ROWS.map(
    (row) => `
      <tr>
        <td class="leaderboard-rank top-${row.rank}">#${row.rank}</td>
        <td class="leaderboard-player-id">${row.playerId}</td>
        <td class="num leaderboard-score">${row.score.toLocaleString("en-US")}</td>
        <td class="num">${row.maxTile.toLocaleString("en-US")}</td>
        <td class="num">${row.moves.toLocaleString("en-US")}</td>
        <td class="meta-text">2026-09-15 12:00 UTC</td>
      </tr>`
  ).join("");
  return `
    <div class="leaderboard-table-wrap">
      <table class="leaderboard-table">
        <caption class="sr-only">Bitstorm Daily standings</caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Player</th>
            <th scope="col" class="num">Score</th>
            <th scope="col" class="num">Max tile</th>
            <th scope="col" class="num">Moves</th>
            <th scope="col">Submitted</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

test.describe("leaderboard presentation", () => {
  test("shows an empty state for ranked standings with no submissions", async ({ page }) => {
    await page.goto("/leaderboard?tab=ranked");
    await expect(page.getByRole("heading", { name: "Ranked", exact: true })).toBeVisible();
    await expect(page.getByText("No ranked runs yet.")).toBeVisible();
    await expect(page.locator("table.leaderboard-table")).toHaveCount(0);
  });

  test("shows an empty state for daily standings with no submissions", async ({ page }) => {
    await page.goto("/leaderboard?tab=daily");
    await expect(page.getByText(/No submissions for today's Bitstorm Daily yet\./)).toBeVisible();
    await expect(page.locator("table.leaderboard-table")).toHaveCount(0);
  });

  test("marks the active tab with aria-current", async ({ page }) => {
    await page.goto("/leaderboard?tab=ranked&namespace=production&seasonMode=live");
    await expect(page.getByRole("link", { name: "Ranked" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Bitstorm Daily" })).not.toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Preview Season" })).not.toHaveAttribute("aria-current", "page");

    await page.goto("/leaderboard?tab=daily&namespace=production&seasonMode=live");
    await expect(page.getByRole("link", { name: "Bitstorm Daily" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Ranked" })).not.toHaveAttribute("aria-current", "page");
  });

  test("shows the sandbox preview banner only in preview/sandbox views", async ({ page }) => {
    await page.goto("/leaderboard?tab=ranked&namespace=production&seasonMode=live");
    await expect(page.getByText(/Sandbox preview/)).toHaveCount(0);

    await page.goto("/leaderboard?tab=ranked&namespace=sandbox&seasonMode=preview");
    await expect(page.getByText(/Sandbox preview: these standings are isolated/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Preview Season" })).toHaveAttribute("aria-current", "page");
  });

  test("keyboard focus reaches the leaderboard nav links with a visible outline", async ({ page }) => {
    await page.goto("/leaderboard?tab=ranked");
    const rankedLink = page.getByRole("link", { name: "Ranked" });
    await rankedLink.focus();
    await expect(rankedLink).toBeFocused();
    const outline = await rankedLink.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Bitstorm Daily" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Preview Season" })).toBeFocused();
  });

  test("[fixture] populated ranked standings table layout/CSS is scannable (not real component render)", async ({ page }) => {
    await page.goto("/leaderboard?tab=ranked");
    await page.waitForSelector(".leaderboard-empty", { timeout: 10_000 });
    await page.evaluate((html) => {
      const section = document.querySelector('section[aria-label="Ranked standings"]');
      const empty = section?.querySelector(".leaderboard-empty");
      if (empty) empty.outerHTML = html;
    }, buildRankedTableHtml());

    const table = page.locator("table.leaderboard-table");
    await expect(table).toBeVisible();
    await expect(table.locator("thead th")).toHaveCount(6);
    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0).locator(".leaderboard-rank")).toHaveClass(/top-1/);
    await expect(rows.nth(0)).toContainText("2,048");
    await expect(rows.nth(0)).toContainText("Player");
    await expect(rows.nth(0)).toContainText("player_a");
    await expect(rows.nth(1)).toContainText("Pro");
  });

  test("[fixture] populated daily standings table layout/CSS is scannable (not real component render)", async ({ page }) => {
    await page.goto("/leaderboard?tab=daily");
    await page.waitForSelector(".leaderboard-empty", { timeout: 10_000 });
    await page.evaluate((html) => {
      const section = document.querySelector('section[aria-label="Bitstorm Daily standings"]');
      const empty = section?.querySelector(".leaderboard-empty");
      if (empty) empty.outerHTML = html;
    }, buildDailyTableHtml());

    const table = page.locator("table.leaderboard-table");
    await expect(table).toBeVisible();
    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("2,048");
    await expect(rows.nth(2)).toContainText("player_gamma_extra_long_id");
  });

  test("[fixture] the populated table scrolls horizontally on narrow screens without widening the page", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/leaderboard?tab=ranked");
    await page.waitForSelector(".leaderboard-empty", { timeout: 10_000 });
    await page.evaluate((html) => {
      const section = document.querySelector('section[aria-label="Ranked standings"]');
      const empty = section?.querySelector(".leaderboard-empty");
      if (empty) empty.outerHTML = html;
    }, buildRankedTableHtml());

    const overflow = await page.evaluate(() => {
      const wrap = document.querySelector(".leaderboard-table-wrap") as HTMLElement;
      return {
        wrapScrollWidth: wrap.scrollWidth,
        wrapClientWidth: wrap.clientWidth,
        pageScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth
      };
    });
    // The inner wrap may need to scroll (it has 6 columns of real content)…
    expect(overflow.wrapScrollWidth).toBeGreaterThan(overflow.wrapClientWidth);
    // …but the outer page must never grow wider than the viewport.
    expect(overflow.pageScrollWidth).toBeLessThanOrEqual(overflow.viewportWidth + 1);
  });
});
