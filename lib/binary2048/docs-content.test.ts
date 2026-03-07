import { readFileSync } from "fs";
import { join } from "path";

describe("docs content", () => {
  const repoRoot = join(__dirname, "..", "..");

  it("contains user and developer markdown guides with expected sections", () => {
    const user = readFileSync(join(repoRoot, "docs", "user-guide.md"), "utf8");
    const dev = readFileSync(join(repoRoot, "docs", "developer-guide.md"), "utf8");
    const replayStorage = readFileSync(join(repoRoot, "docs", "replay-storage-strategy.md"), "utf8");
    const telemetry = readFileSync(join(repoRoot, "docs", "telemetry-alarms.md"), "utf8");
    const nxdomain = readFileSync(join(repoRoot, "docs", "route53-nxdomain-runbook.md"), "utf8");
    const monetization = readFileSync(join(repoRoot, "docs", "player-monetization-policy.md"), "utf8");
    const botQuickstart = readFileSync(join(repoRoot, "docs", "bot-api-quickstart.md"), "utf8");
    const botBenchmark = readFileSync(join(repoRoot, "docs", "bot-benchmark-suite.md"), "utf8");
    const launchPackage = readFileSync(join(repoRoot, "docs", "bot-first-launch-package.md"), "utf8");
    expect(user).toContain("# Binary-2048 User Guide");
    expect(user).toContain("## Replay and Sharing");
    expect(dev).toContain("# Binary-2048 Developer Guide");
    expect(dev).toContain("## Replay Model");
    expect(replayStorage).toContain("# Binary-2048 Replay Storage Strategy");
    expect(replayStorage).toContain("## Phase 1: No-DB Default (Current Lightweight Mode)");
    expect(telemetry).toContain("# Telemetry And Anomaly Visibility");
    expect(telemetry).toContain("GET /api/ops/telemetry");
    expect(nxdomain).toContain("# Route 53 NXDOMAIN Runbook");
    expect(nxdomain).toContain("npm run ops:waf:nxdomain");
    expect(monetization).toContain("# Player Monetization Policy");
    expect(monetization).toContain("never pay-to-win");
    expect(botQuickstart).toContain("# Bot API Quickstart");
    expect(botQuickstart).toContain("Python starter");
    expect(botBenchmark).toContain("# Bot Benchmark Suite");
    expect(launchPackage).toContain("# Bot-First Launch Package");
  });

  it("links docs routes from api docs page and README", () => {
    const apiDocsPage = readFileSync(join(repoRoot, "app", "api-docs", "page.tsx"), "utf8");
    const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
    expect(apiDocsPage).toContain('href="/docs"');
    expect(apiDocsPage).toContain('href="/docs/user"');
    expect(apiDocsPage).toContain('href="/docs/developer"');
    expect(readme).toContain("http://localhost:3000/docs");
    expect(readme).toContain("http://localhost:3000/docs/user");
    expect(readme).toContain("http://localhost:3000/docs/developer");
    expect(readme).toContain("http://localhost:3000/monetization");
    expect(readme).toContain("npm run ops:waf:nxdomain");
    expect(readme).toContain("NOTIFICATION_THRESHOLDS");
    expect(readme).toContain("REQUIRE_ALARM_ACTIONS=1");
    expect(apiDocsPage).toContain('href="/docs/user"');
  });
});
