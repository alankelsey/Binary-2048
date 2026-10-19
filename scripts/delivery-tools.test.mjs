import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { formatJestSummary } = require("./concise-jest-reporter.cjs");
const { formatPlaywrightSummary } = require("./concise-playwright-reporter.cjs");
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("concise Jest summary retains totals and failure state", () => {
  const summary = formatJestSummary({
    success: false,
    numPassedTestSuites: 4,
    numFailedTestSuites: 1,
    numTotalTestSuites: 5,
    numPassedTests: 19,
    numFailedTests: 1,
    numPendingTests: 2,
    numTotalTests: 22
  });

  assert.match(summary, /^FAIL:/);
  assert.match(summary, /4 suites passed, 1 suite failed, 5 suites total/);
  assert.match(summary, /19 tests passed, 1 test failed, 2 tests skipped, 22 tests total/);
});

test("concise Jest summary derives a passing state from native counts", () => {
  const summary = formatJestSummary({
    numPassedTestSuites: 1,
    numFailedTestSuites: 0,
    numTotalTestSuites: 1,
    numPassedTests: 3,
    numFailedTests: 0,
    numPendingTests: 0,
    numTotalTests: 3,
    wasInterrupted: false
  });

  assert.match(summary, /^PASS:/);
});

test("concise Jest reporter prints a failed suite even when no test executed", () => {
  const writes = [];
  const originalWrite = process.stderr.write;
  process.stderr.write = ((chunk) => {
    writes.push(String(chunk));
    return true;
  });
  try {
    const Reporter = require("./concise-jest-reporter.cjs");
    new Reporter().onRunComplete(new Set(), {
      numPassedTestSuites: 0,
      numFailedTestSuites: 1,
      numTotalTestSuites: 1,
      numPassedTests: 0,
      numFailedTests: 0,
      numPendingTests: 0,
      numTotalTests: 0,
      wasInterrupted: false,
      testResults: [{
        testFilePath: "/fixture/compile.test.ts",
        failureMessage: "TypeScript compile error"
      }]
    });
  } finally {
    process.stderr.write = originalWrite;
  }

  assert.match(writes.join(""), /TypeScript compile error/);
});

test("concise Playwright summary retains expected skips", () => {
  const summary = formatPlaywrightSummary(
    { passed: 68, failed: 0, skipped: 1, total: 69 },
    "passed"
  );

  assert.match(summary, /^PASS:/);
  assert.match(summary, /68 passed, 0 failed, 1 skipped, 69 total/);
});

test("concise Playwright reporter runs a real fixture", () => {
  const result = spawnSync(
    path.join(repositoryRoot, "node_modules", ".bin", "playwright"),
    [
      "test",
      "scripts/fixtures/concise-playwright.spec.cjs",
      "--reporter=./scripts/concise-playwright-reporter.cjs",
      "--workers=1"
    ],
    { cwd: repositoryRoot, encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS: 1 passed, 0 failed, 0 skipped, 1 total/);
});

async function createFakeAwsDirectory(statuses, commit = "abc123") {
  const directory = await mkdtemp(path.join(tmpdir(), "binary2048-amplify-watch-"));
  const awsPath = path.join(directory, "aws");
  const statePath = path.join(directory, "state");
  const callsPath = path.join(directory, "calls");
  const script = `#!/usr/bin/env bash
set -euo pipefail
echo "$*" >> "${callsPath}"
if [[ "$*" == *"list-jobs"* ]]; then
  echo "77"
  exit 0
fi
count=0
if [[ -f "${statePath}" ]]; then count="$(cat "${statePath}")"; fi
statuses=(${statuses.join(" ")})
index="$count"
if (( index >= \${#statuses[@]} )); then index=$((\${#statuses[@]} - 1)); fi
printf '%s\\t%s\\n' "\${statuses[$index]}" "${commit}"
echo $((count + 1)) > "${statePath}"
`;
  await writeFile(awsPath, script);
  await chmod(awsPath, 0o755);
  return { directory, callsPath };
}

test("Amplify watcher combines status and commit polling and preserves exact commit", async () => {
  const fake = await createFakeAwsDirectory(["RUNNING", "RUNNING", "SUCCEED"]);
  const result = spawnSync("bash", ["./scripts/amplify-deploy-watch.sh"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${fake.directory}:${process.env.PATH}`,
      APP_ID: "test-app",
      BRANCH_NAME: "main",
      AWS_REGION: "test-region",
      POLL_SECONDS: "0",
      REPORT_SECONDS: "60",
      TIMEOUT_SECONDS: "30",
      EXPECT_COMMIT_ID: "abc123"
    }
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Amplify deploy succeeded for job 77/);
  const calls = (await readFile(fake.callsPath, "utf8")).trim().split("\n");
  assert.equal(calls.filter((line) => line.includes("list-jobs")).length, 1);
  const getJobCalls = calls.filter((line) => line.includes("get-job"));
  assert.equal(getJobCalls.length, 3);
  assert.ok(
    getJobCalls.every((line) =>
      line.includes("[job.summary.status, job.summary.commitId]")
    )
  );
});

test("Amplify watcher fails before waiting on a different commit", async () => {
  const fake = await createFakeAwsDirectory(["RUNNING"], "other123");
  const result = spawnSync("bash", ["./scripts/amplify-deploy-watch.sh"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${fake.directory}:${process.env.PATH}`,
      APP_ID: "test-app",
      POLL_SECONDS: "0",
      EXPECT_COMMIT_ID: "abc123"
    }
  });

  assert.equal(result.status, 4);
  assert.match(result.stderr, /Amplify commit mismatch/);
  const calls = (await readFile(fake.callsPath, "utf8")).trim().split("\n");
  assert.equal(calls.filter((line) => line.includes("get-job")).length, 1);
});
