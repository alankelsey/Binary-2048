import { defineConfig } from "@playwright/test";

const port = 3101;

export default defineConfig({
  testDir: "./tests/ui",
  testMatch: "diagnostics.browser.spec.ts",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: true
  },
  webServer: {
    command: `NEXT_PUBLIC_GAME_LOG_ENABLED=1 NEXT_DIST_DIR=.next-dev NEXT_DISABLE_WEBPACK_CACHE=1 next dev -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000
  },
  reporter: [["list"]]
});
