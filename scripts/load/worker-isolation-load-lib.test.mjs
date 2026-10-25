import test from "node:test";
import assert from "node:assert/strict";
import {
  boundedInteger,
  buildWorkerTaskSpecs,
  evaluatePair,
  evaluateReport,
  isLoopbackTarget,
  percentile,
  summarizeBrowser
} from "./worker-isolation-load-lib.mjs";

test("percentile uses the nearest-rank definition", () => {
  assert.equal(percentile([4, 1, 3, 2], 95), 4);
  assert.equal(percentile([], 95), null);
});

test("boundedInteger rejects values outside the operator envelope", () => {
  assert.equal(boundedInteger(undefined, 4, { name: "workers", min: 1, max: 4 }), 4);
  assert.throws(() => boundedInteger("5", 4, { name: "workers", min: 1, max: 4 }), /1 through 4/);
});

test("loopback classification does not treat external hosts as local", () => {
  assert.equal(isLoopbackTarget("http://localhost:3000"), true);
  assert.equal(isLoopbackTarget("https://www.binary2048.com"), false);
});

test("paired gate applies both absolute and relative allowances", () => {
  assert.equal(evaluatePair({ baseline: 50, loaded: 70, absoluteLimitMs: 100 }).passed, true);
  assert.equal(evaluatePair({ baseline: 50, loaded: 71, absoluteLimitMs: 100 }).passed, false);
  assert.equal(evaluatePair({ baseline: 90, loaded: 105, absoluteLimitMs: 100 }).passed, false);
});

test("browser summary derives warm acknowledgement p95", () => {
  const result = summarizeBrowser({
    deployedCommit: "abc1234",
    browser: "Chrome",
    metricLimit: "callback",
    deliberate: {
      intendedInputs: 2,
      classifiedInputs: 2,
      summary: { p95Ms: 80 },
      localPredictionSummary: { p95Ms: 12 },
      samples: [
        { disposition: "accepted", serverTimingMs: { total: 12 } },
        { disposition: "accepted", serverTimingMs: { total: 18 } }
      ]
    }
  });
  assert.equal(result.warmAcknowledgementP95Ms, 18);
  assert.equal(result.inputToPaintP95Ms, 12);
  assert.equal(result.droppedInputs, 0);
});

test("worker task shapes stay at the public aggregate-compute caps", () => {
  const tasks = buildWorkerTaskSpecs({ jobsPerClass: 2, tournamentQueueUrl: "tournament", trainingQueueUrl: "training" });
  assert.equal(tasks.length, 4);
  for (const item of tasks.filter((task) => task.className === "tournament")) {
    const request = item.task.args[0];
    assert.equal(request.seeds.length * request.bots.length * request.maxMoves, 25_000);
  }
  for (const item of tasks.filter((task) => task.className === "training")) {
    assert.deepEqual(item.task.args.slice(1, 3), [500, "rollout"]);
  }
});

test("overall report requires both worker classes and completed bounded jobs", () => {
  const stage = {
    browser: { inputToPaintP95Ms: 12, inputToNextFrameP95Ms: 50, warmAcknowledgementP95Ms: 20, intendedInputs: 20, classifiedInputs: 20, droppedInputs: 0, queuedInputs: 0 },
    http: { moveP95Ms: 30, errors: 0 }
  };
  const report = evaluateReport({
    baseline: stage,
    loaded: stage,
    workerOverlap: { tournament: true, training: true },
    jobs: [{ status: "complete", attempts: 1 }]
  });
  assert.equal(report.passed, true);
  assert.equal(evaluateReport({ ...report, baseline: stage, loaded: stage, workerOverlap: { tournament: true, training: false }, jobs: [{ status: "complete", attempts: 1 }] }).passed, false);
});
