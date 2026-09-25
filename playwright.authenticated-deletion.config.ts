import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const confirmation = "DELETE_DEDICATED_BINARY2048_TEST_ACCOUNT_DATA";
const storageState = "artifacts/auth-deletion-dedicated/storage-state.json";
const productionBase = "https://www.binary2048.com";

if (process.env.ALLOW_PRODUCTION_DATA_DELETION !== confirmation) {
  throw new Error("Destructive authenticated acceptance was not explicitly confirmed.");
}
if (process.env.AUTH_DELETION_STORAGE_STATE !== storageState) {
  throw new Error("Destructive acceptance requires the dedicated deletion-test browser state.");
}
if (process.env.AUTH_BASE !== productionBase) {
  throw new Error("Destructive acceptance requires the explicit production base URL.");
}
if (!/^[a-f0-9]{64}$/.test(process.env.AUTH_DELETION_ACCOUNT_SHA256 ?? "")) {
  throw new Error("Destructive acceptance requires a dedicated account identity SHA-256.");
}
if (!existsSync(storageState)) {
  throw new Error("Dedicated deletion-test browser state was not found.");
}

export default defineConfig({
  testDir: "./tests/authenticated-deletion",
  timeout: 60_000,
  retries: 0,
  outputDir: "artifacts/auth-deletion-dedicated/test-results",
  use: {
    baseURL: productionBase,
    storageState,
    headless: true,
    trace: "retain-on-failure"
  },
  reporter: [["list"]]
});
