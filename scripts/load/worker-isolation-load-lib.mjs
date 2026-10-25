export function percentile(values, percent) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * percent / 100) - 1)];
}

export function boundedInteger(raw, fallback, { name, min, max }) {
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} through ${max}`);
  }
  return value;
}

export function isLoopbackTarget(raw) {
  const hostname = new URL(raw).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function evaluatePair({ baseline, loaded, absoluteLimitMs, minimumAllowanceMs = 20, relativeAllowance = 0.2 }) {
  if (![baseline, loaded, absoluteLimitMs].every(Number.isFinite)) {
    throw new Error("Comparison metrics must be finite numbers");
  }
  const allowanceMs = Math.max(minimumAllowanceMs, baseline * relativeAllowance);
  const deltaMs = loaded - baseline;
  return {
    baselineMs: baseline,
    loadedMs: loaded,
    deltaMs,
    allowanceMs,
    absoluteLimitMs,
    passed: loaded <= absoluteLimitMs && deltaMs <= allowanceMs
  };
}

export function summarizeBrowser(result) {
  const samples = result?.deliberate?.samples ?? [];
  const acknowledgement = samples.map((sample) => sample?.serverTimingMs?.total).filter(Number.isFinite);
  if (!samples.length || acknowledgement.length !== samples.length) {
    throw new Error("Browser result is missing deliberate warm-acknowledgement timings");
  }
  return {
    inputToPaintP95Ms: result.deliberate.localPredictionSummary.p95Ms,
    inputToNextFrameP95Ms: result.deliberate.summary.p95Ms,
    warmAcknowledgementP95Ms: percentile(acknowledgement, 95),
    intendedInputs: result.deliberate.intendedInputs,
    classifiedInputs: result.deliberate.classifiedInputs,
    droppedInputs: result.deliberate.intendedInputs - result.deliberate.classifiedInputs,
    queuedInputs: samples.filter((sample) => sample.disposition === "queued").length,
    deployedCommit: result.deployedCommit,
    browser: result.browser,
    metricLimit: result.metricLimit
  };
}

export function buildWorkerTaskSpecs({ jobsPerClass, tournamentQueueUrl, trainingQueueUrl }) {
  const records = [];
  for (let index = 0; index < jobsPerClass; index += 1) {
    const seeds = Array.from({ length: 25 }, (_, offset) => 100000 + index * 100 + offset);
    records.push({
      className: "tournament",
      queueUrl: tournamentQueueUrl,
      task: { kind: "tournament", args: [{ seeds, maxMoves: 500, bots: ["rollout", "priority"], includeTraces: false }] }
    });
    records.push({
      className: "training",
      queueUrl: trainingQueueUrl,
      task: { kind: "training-labels", args: [1000 + index, 500, "rollout", 0] }
    });
  }
  return records;
}

export function evaluateReport({ baseline, loaded, workerOverlap, jobs }) {
  const comparisons = {
    inputToPaint: evaluatePair({
      baseline: baseline.browser.inputToPaintP95Ms,
      loaded: loaded.browser.inputToPaintP95Ms,
      absoluteLimitMs: 100
    }),
    warmAcknowledgement: evaluatePair({
      baseline: baseline.browser.warmAcknowledgementP95Ms,
      loaded: loaded.browser.warmAcknowledgementP95Ms,
      absoluteLimitMs: 200
    }),
    httpGameplay: evaluatePair({
      baseline: baseline.http.moveP95Ms,
      loaded: loaded.http.moveP95Ms,
      absoluteLimitMs: 400
    })
  };
  const inputsPassed = [baseline.browser, loaded.browser].every(
    (sample) => sample.droppedInputs === 0 && sample.queuedInputs === 0 && sample.intendedInputs === sample.classifiedInputs
  );
  const httpPassed = [baseline.http, loaded.http].every((sample) => sample.errors === 0);
  const jobsPassed = jobs.length > 0 && jobs.every((job) => job.status === "complete" && job.attempts >= 1 && job.attempts <= 2);
  const overlapPassed = workerOverlap.tournament && workerOverlap.training;
  return {
    passed: Object.values(comparisons).every((item) => item.passed) && inputsPassed && httpPassed && jobsPassed && overlapPassed,
    comparisons,
    gates: { inputsPassed, httpPassed, jobsPassed, overlapPassed }
  };
}
