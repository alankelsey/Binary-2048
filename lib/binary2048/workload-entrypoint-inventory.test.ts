import fs from "fs";
import path from "path";

type Entry = {
  id: string;
  category: string;
  kind: "http" | "script" | "worker";
  source: string;
  entrypoint: string;
  aliases?: string[];
  runtime: string;
  mutation: string;
  scope?: string;
  caps?: string;
};

const root = process.cwd();
const inventory = JSON.parse(
  fs.readFileSync(path.join(root, "docs/v2-phase5-workload-entrypoints.json"), "utf8")
) as { version: number; entries: Entry[] };
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

const expectedIds = [
  "http-job-status", "http-model-registry", "http-replay-ingest", "http-simulate",
  "http-tournament", "http-training-labels", "http-training-replays",
  "script-bot-benchmark", "script-bot-smoke", "script-bot-tournament",
  "script-challenge-benchmark", "script-feature-extract", "script-hugging-face",
  "script-league-sandbox", "script-ml-baseline", "script-model-dataset-export",
  "script-ollama", "script-replay-ingest", "script-rollout-trace", "script-run-export",
  "script-worker-acceptance", "worker-sqs-handler"
].sort();

describe("Phase 5 workload entry-point inventory", () => {
  it("keeps the reviewed HTTP, worker, and executable script surface exact", () => {
    expect(inventory.version).toBe(2);
    expect(inventory.entries.map((entry) => entry.id).sort()).toEqual(expectedIds);
    expect(new Set(inventory.entries.map((entry) => entry.id)).size).toBe(inventory.entries.length);
  });

  it("points every entry at an implemented handler or package command", () => {
    for (const entry of inventory.entries) {
      expect(entry.runtime).not.toHaveLength(0);
      expect(entry.mutation).not.toHaveLength(0);
      const source = fs.readFileSync(path.join(root, entry.source), "utf8");
      if (entry.kind === "http") {
        expect(source).toMatch(new RegExp(`export\\s+async\\s+function\\s+${entry.entrypoint}\\b`));
      } else if (entry.kind === "worker") {
        expect(source).toMatch(/export\s+async\s+function\s+handler\b/);
      } else {
        expect(packageJson.scripts[entry.entrypoint]).toContain(entry.source);
        for (const alias of entry.aliases ?? []) expect(packageJson.scripts[alias]).toBeTruthy();
      }
    }
  });

  it("locks the scoped authorization, owner binding, and hard-cap boundaries", () => {
    const rateLimit = fs.readFileSync(path.join(root, "lib/binary2048/rate-limit.ts"), "utf8");
    const replayIngest = fs.readFileSync(path.join(root, "app/api/replay/ingest/route.ts"), "utf8");
    const jobs = fs.readFileSync(path.join(root, "app/api/jobs/[id]/route.ts"), "utf8");
    const researchAuth = fs.readFileSync(path.join(root, "lib/binary2048/research-auth.ts"), "utf8");
    expect(rateLimit).toContain("resolveBotApiKey(req.headers.get(\"x-api-key\"))");
    expect(rateLimit).toContain("scope: \"api-key\"");
    expect(researchAuth).toContain("BINARY2048_BOT_API_KEY_SCOPES");
    expect(researchAuth).toContain("resolveBotApiKey(presentedKey)");
    expect(replayIngest).toContain('authorizeResearchRequest(req, "replay:ingest")');
    expect(replayIngest).toContain("MAX_INGEST_RECORDS = 100");
    expect(replayIngest).toContain("parseJsonWithLimit");
    expect(jobs).toContain("checkJobStatusRateLimit(req)");
    expect(jobs).toContain('authorizeResearchRequest(req, "jobs:read")');
    expect(jobs).toContain("job.owner !== authorization.authority.principal");
    expect(jobs).toContain("/^[a-f0-9]{64}$/");
    expect(inventory.entries.find((entry) => entry.id === "http-tournament")?.caps).toContain("128 KiB");
    expect(inventory.entries.find((entry) => entry.id === "http-replay-ingest")?.scope).toBe("replay:ingest");
  });
});
