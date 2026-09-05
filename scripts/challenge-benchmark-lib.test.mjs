import assert from "node:assert/strict";
import test from "node:test";
import { evaluateChallengeTrace, renderChallengeReport, summarizeChallengeRecords, summarizeSkillResults } from "./challenge-benchmark-lib.mjs";

const scenario = { expectedInvariants: { probes: [{ action: "L" }, { action: "R" }] } };

test("scores a trace by its validated first-action objective", () => {
  assert.equal(evaluateChallengeTrace(scenario, { decisions: [{ decision: { action: "L" } }] }).passed, true);
  assert.equal(evaluateChallengeTrace(scenario, { decisions: [{ decision: { action: "U" } }] }).passed, false);
  assert.equal(evaluateChallengeTrace(scenario, { decisions: [] }).passed, false);
});

test("aggregates challenge metrics separately by model and provider", () => {
  const records = [
    { model: { id: "rollout", provider: "rollout" }, objective: { passed: true }, metrics: { moves: 2, score: 6, inputTokens: 0, outputTokens: 0, fallbackCount: 0, totalModelLatencyMs: 10 }, estimatedCostUsd: { listedTokenRates: 0, conservativeObservedRequestRate: 0 } },
    { model: { id: "rollout", provider: "rollout" }, objective: { passed: false }, metrics: { moves: 1, score: 2, inputTokens: 0, outputTokens: 0, fallbackCount: 0, totalModelLatencyMs: 5 }, estimatedCostUsd: { listedTokenRates: 0, conservativeObservedRequestRate: 0 } }
  ];
  assert.deepEqual(summarizeChallengeRecords(records)[0], expectSummary());
});

function expectSummary() {
  return { modelId: "rollout", provider: "rollout", scenarios: 2, passed: 1, moves: 3, score: 8, inputTokens: 0, outputTokens: 0, fallbacks: 0, totalLatencyMs: 15, listedCostUsd: 0, conservativeCostUsd: 0, passRate: 0.5, averageLatencyMs: 5 };
}

test("renders an explicitly labeled fixed-board report", () => {
  const record = { scenario: { scenarioId: "merge", scenarioVersion: 1, skillTags: ["number-merge"] }, model: { id: "rollout", provider: "rollout" }, objective: { passed: true, selectedAction: "L", expectedActions: ["L"] }, metrics: { moves: 1, score: 2, maxTile: 2, inputTokens: 0, outputTokens: 0, fallbackCount: 0, totalModelLatencyMs: 1 }, estimatedCostUsd: { listedTokenRates: 0, conservativeObservedRequestRate: 0 } };
  const report = renderChallengeReport({ corpusId: "corpus", corpusVersion: "1.0.0", rulesetId: "rules" }, [record]);
  assert.match(report, /fixed-board track/i);
  assert.match(report, /1\/1/);
  assert.match(report, /number-merge/);
  assert.equal(summarizeSkillResults([record])[0].passRate, 1);
});
