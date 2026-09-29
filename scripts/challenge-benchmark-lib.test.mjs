import assert from "node:assert/strict";
import test from "node:test";
import { correctChallengeObjectives, correctFallbackObjectives, evaluateChallengeTrace, renderChallengeReport, summarizeChallengeRecords, summarizeSkillResults } from "./challenge-benchmark-lib.mjs";

const scenario = { expectedInvariants: { probes: [{ action: "L" }, { action: "R" }] } };

test("scores a trace by its validated first-action objective", () => {
  assert.equal(evaluateChallengeTrace(scenario, { decisions: [{ decision: { action: "L" } }] }).passed, true);
  assert.equal(evaluateChallengeTrace(scenario, { decisions: [{ decision: { action: "L", fallback: true } }] }).passed, false);
  assert.equal(evaluateChallengeTrace(scenario, { decisions: [{ decision: { action: "U" } }] }).passed, false);
  assert.equal(evaluateChallengeTrace(scenario, { decisions: [] }).passed, false);
});

test("requires a complete exhaustively optimal sequence for multi-step objectives", () => {
  const dense = {
    objective: {
      type: "exhaustive-horizon",
      horizon: 4,
      optimalActionSequences: [["D", "L", "R", "U"], ["R", "U", "D", "L"]]
    }
  };
  const trace = (actions, fallbackAt = -1) => ({ decisions: actions.map((action, index) => ({ decision: { action, fallback: index === fallbackAt } })) });
  assert.equal(evaluateChallengeTrace(dense, trace(["D", "L", "R", "U"])).passed, true);
  assert.equal(evaluateChallengeTrace(dense, trace(["D", "L", "R"])).passed, false);
  assert.equal(evaluateChallengeTrace(dense, trace(["D", "U", "R", "D"])).passed, false);
  assert.equal(evaluateChallengeTrace(dense, trace(["R", "U", "D", "L"], 2)).passed, false);
});

test("re-scores stored traces against the current scenario objective", () => {
  const corpus = { scenarios: [{ scenarioId: "dense", scenarioVersion: 2, objective: { type: "exhaustive-horizon", horizon: 2, optimalActionSequences: [["R", "D"]] } }] };
  const records = [{ scenario: { scenarioId: "dense", scenarioVersion: 1 }, objective: { passed: false }, trace: { decisions: [{ decision: { action: "R" } }, { decision: { action: "D" } }] } }];
  assert.equal(correctChallengeObjectives(records, corpus), 1);
  assert.equal(records[0].objective.passed, true);
  assert.equal(records[0].scenario.scenarioVersion, 2);
  assert.equal(correctChallengeObjectives(records, corpus), 0);
});

test("aggregates challenge metrics separately by model and provider", () => {
  const records = [
    { model: { id: "rollout", provider: "rollout", type: "monte-carlo-rollout", thinkingEnabled: false }, objective: { passed: true }, metrics: { moves: 2, score: 6, inputTokens: 0, outputTokens: 0, fallbackCount: 0, totalModelLatencyMs: 10 }, estimatedCostUsd: { listedTokenRates: 0, conservativeObservedRequestRate: 0 } },
    { model: { id: "rollout", provider: "rollout", type: "monte-carlo-rollout", thinkingEnabled: false }, objective: { passed: false }, metrics: { moves: 1, score: 2, inputTokens: 0, outputTokens: 0, fallbackCount: 0, totalModelLatencyMs: 5 }, estimatedCostUsd: { listedTokenRates: 0, conservativeObservedRequestRate: 0 } }
  ];
  assert.deepEqual(summarizeChallengeRecords(records)[0], expectSummary());
});

test("does not merge reasoning and non-thinking runs for the same hosted model", () => {
  const base = { id: "model", provider: "host", type: "non-thinking", thinkingEnabled: false };
  const metric = { moves: 1, score: 1, inputTokens: 1, outputTokens: 1, fallbackCount: 0, totalModelLatencyMs: 1 };
  const cost = { listedTokenRates: 0, conservativeObservedRequestRate: 0 };
  const summary = summarizeChallengeRecords([
    { model: base, objective: { passed: true }, metrics: metric, estimatedCostUsd: cost },
    { model: { ...base, type: "reasoning-style", thinkingEnabled: true }, objective: { passed: false }, metrics: metric, estimatedCostUsd: cost }
  ]);
  assert.equal(summary.length, 2);
  assert.deepEqual(summary.map((row) => row.thinkingEnabled).sort(), [false, true]);
});

test("removes credit from historical fallback objectives", () => {
  const records = [{ objective: { passed: true }, trace: { decisions: [{ decision: { fallback: true } }] } }];
  assert.equal(correctFallbackObjectives(records), 1);
  assert.equal(records[0].objective.passed, false);
});

function expectSummary() {
  return { modelId: "rollout", provider: "rollout", modelType: "monte-carlo-rollout", thinkingEnabled: false, maxOutputTokens: null, scenarios: 2, passed: 1, moves: 3, score: 8, inputTokens: 0, outputTokens: 0, fallbacks: 0, totalLatencyMs: 15, listedCostUsd: 0, conservativeCostUsd: 0, passRate: 0.5, averageLatencyMs: 5 };
}

test("renders an explicitly labeled fixed-board report", () => {
  const record = { scenario: { scenarioId: "merge", scenarioVersion: 1, skillTags: ["number-merge"] }, model: { id: "rollout", provider: "rollout", type: "monte-carlo-rollout", thinkingEnabled: false }, objective: { passed: true, selectedAction: "L", expectedActions: ["L"] }, metrics: { moves: 1, score: 2, maxTile: 2, inputTokens: 0, outputTokens: 0, fallbackCount: 0, totalModelLatencyMs: 1 }, estimatedCostUsd: { listedTokenRates: 0, conservativeObservedRequestRate: 0 } };
  const report = renderChallengeReport({ corpusId: "corpus", corpusVersion: "1.0.0", rulesetId: "rules" }, [record]);
  assert.match(report, /fixed-board track/i);
  assert.match(report, /1\/1/);
  assert.match(report, /number-merge/);
  assert.equal(summarizeSkillResults([record])[0].passRate, 1);
});
