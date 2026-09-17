import { defineConfig } from "@playwright/test";

const baseURL = process.env.UI_BASE ?? "http://localhost:3000";
const hostname = new URL(baseURL).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
  throw new Error(`UI Playwright tests require a loopback base URL; received ${baseURL}`);
}

// Local-only UI Playwright suite (mobile action dock, difficulty help,
// leaderboard presentation). These tests mock API responses and/or inject
// fixture markup, so they must run against a local dev server, never
// production — see docs/mobile-ui-accessibility-audit-2026-09-15.md.
// Run with `npm run test:ui` after starting `npm run dev:once` (or point
// UI_BASE at whatever local server you already have running).
export default defineConfig({
  testDir: "./tests/ui",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL,
    headless: true
  },
  reporter: [["list"]]
});
