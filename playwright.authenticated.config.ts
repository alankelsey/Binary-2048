import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const storageState = process.env.AUTH_STORAGE_STATE ?? "artifacts/auth-acceptance/storage-state.json";
if (!existsSync(storageState)) {
  throw new Error(`Authenticated browser state not found at ${storageState}. Run npm run ops:auth:capture first.`);
}

export default defineConfig({
  testDir: "./tests/authenticated",
  timeout: 60_000,
  retries: 0,
  outputDir: "artifacts/auth-acceptance/test-results",
  use: {
    baseURL: process.env.AUTH_BASE ?? process.env.PROD_BASE ?? "https://main.dzxvs1esr22z9.amplifyapp.com",
    storageState,
    headless: process.env.AUTH_HEADLESS !== "0",
    trace: "retain-on-failure"
  },
  reporter: [["list"]]
});
