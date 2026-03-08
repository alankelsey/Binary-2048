import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/prod",
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: process.env.PROD_BASE ?? "https://www.binary2048.com",
    headless: true
  },
  reporter: [["list"]]
});
