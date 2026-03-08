#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const input = process.env.IN ?? "data/runs-features.jsonl";
const output = process.env.OUT ?? "data/ml-baseline-report.json";

function seedFromId(runId) {
  let hash = 2166136261;
  for (let i = 0; i < runId.length; i += 1) {
    hash ^= runId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function splitTrainTest(rows, trainRatio = 0.8) {
  const train = [];
  const test = [];
  for (const row of rows) {
    const bucket = (seedFromId(row.runId) % 1000) / 1000;
    if (bucket < trainRatio) train.push(row);
    else test.push(row);
  }
  return { train, test };
}

function toFeatureVector(row) {
  return [
    1,
    Number(row.f_moves ?? 0),
    Number(row.f_scorePerMove ?? 0),
    Number(row.f_maxTilePerMove ?? 0),
    Number(row.f_actionEntropyApprox ?? 0),
    Number(row.f_boardSize ?? 4),
    Number(row.f_tier ?? 0)
  ];
}

function predict(weights, x) {
  let acc = 0;
  for (let i = 0; i < weights.length; i += 1) acc += weights[i] * x[i];
  return acc;
}

function fit(samples, yKey, iterations = 3000, lr = 0.00002) {
  const weights = new Array(7).fill(0);
  if (!samples.length) return weights;
  for (let iter = 0; iter < iterations; iter += 1) {
    const grad = new Array(7).fill(0);
    for (const sample of samples) {
      const err = predict(weights, sample.x) - Number(sample[yKey] ?? 0);
      for (let i = 0; i < grad.length; i += 1) grad[i] += err * sample.x[i];
    }
    const scale = 1 / samples.length;
    for (let i = 0; i < weights.length; i += 1) weights[i] -= lr * grad[i] * scale;
  }
  return weights;
}

function evaluate(samples, scoreWeights, maxWeights) {
  if (!samples.length) return { scoreMae: 0, scoreRmse: 0, maxMae: 0, maxRmse: 0 };
  let scoreAbs = 0;
  let scoreSq = 0;
  let maxAbs = 0;
  let maxSq = 0;
  for (const sample of samples) {
    const scoreErr = predict(scoreWeights, sample.x) - sample.labelScore;
    const maxErr = predict(maxWeights, sample.x) - sample.labelMaxTile;
    scoreAbs += Math.abs(scoreErr);
    scoreSq += scoreErr * scoreErr;
    maxAbs += Math.abs(maxErr);
    maxSq += maxErr * maxErr;
  }
  return {
    scoreMae: Number((scoreAbs / samples.length).toFixed(6)),
    scoreRmse: Number(Math.sqrt(scoreSq / samples.length).toFixed(6)),
    maxMae: Number((maxAbs / samples.length).toFixed(6)),
    maxRmse: Number(Math.sqrt(maxSq / samples.length).toFixed(6))
  };
}

try {
  const raw = await readFile(input, "utf8");
  const rows = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const { train, test } = splitTrainTest(rows);
  const trainSamples = train.map((row) => ({
    x: toFeatureVector(row),
    labelScore: Number(row.labelScore ?? 0),
    labelMaxTile: Number(row.labelMaxTile ?? 0)
  }));
  const testSamples = test.map((row) => ({
    x: toFeatureVector(row),
    labelScore: Number(row.labelScore ?? 0),
    labelMaxTile: Number(row.labelMaxTile ?? 0)
  }));
  const scoreWeights = fit(trainSamples, "labelScore");
  const maxWeights = fit(trainSamples, "labelMaxTile");
  const metrics = evaluate(testSamples, scoreWeights, maxWeights);
  const report = {
    model: "linear-gd-v1",
    input,
    generatedAt: new Date().toISOString(),
    trainCount: trainSamples.length,
    testCount: testSamples.length,
    score: { mae: metrics.scoreMae, rmse: metrics.scoreRmse },
    maxTile: { mae: metrics.maxMae, rmse: metrics.maxRmse }
  };
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, output, report }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
