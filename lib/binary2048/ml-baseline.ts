export type MlFeatureInput = {
  runId: string;
  labelScore: number;
  labelMaxTile: number;
  f_moves: number;
  f_scorePerMove: number;
  f_maxTilePerMove: number;
  f_actionEntropyApprox: number;
  f_boardSize: number;
  f_tier: 0 | 1 | 2;
};

type Weights = {
  bias: number;
  wMoves: number;
  wScorePerMove: number;
  wMaxTilePerMove: number;
  wEntropy: number;
  wBoardSize: number;
  wTier: number;
};

export type MlBaselineReport = {
  model: "linear-gd-v1";
  trainCount: number;
  testCount: number;
  score: {
    mae: number;
    rmse: number;
  };
  maxTile: {
    mae: number;
    rmse: number;
  };
};

type Sample = {
  x: number[];
  yScore: number;
  yMaxTile: number;
};

function features(row: MlFeatureInput) {
  return [
    1,
    row.f_moves,
    row.f_scorePerMove,
    row.f_maxTilePerMove,
    row.f_actionEntropyApprox,
    row.f_boardSize,
    row.f_tier
  ];
}

function seedFromId(runId: string) {
  let hash = 2166136261;
  for (let i = 0; i < runId.length; i += 1) {
    hash ^= runId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

export function splitTrainTest(rows: MlFeatureInput[], trainRatio = 0.8) {
  const train: MlFeatureInput[] = [];
  const test: MlFeatureInput[] = [];
  for (const row of rows) {
    const bucket = (seedFromId(row.runId) % 1000) / 1000;
    if (bucket < trainRatio) train.push(row);
    else test.push(row);
  }
  return { train, test };
}

function predict(weights: number[], x: number[]) {
  let acc = 0;
  for (let i = 0; i < weights.length; i += 1) {
    acc += weights[i] * x[i];
  }
  return acc;
}

function fitLinearGd(samples: Sample[], yKey: "yScore" | "yMaxTile", iterations = 3000, lr = 0.00002) {
  const weights = new Array(7).fill(0);
  if (samples.length === 0) return weights;
  for (let iter = 0; iter < iterations; iter += 1) {
    const grad = new Array(7).fill(0);
    for (const sample of samples) {
      const y = sample[yKey];
      const yHat = predict(weights, sample.x);
      const err = yHat - y;
      for (let i = 0; i < grad.length; i += 1) {
        grad[i] += err * sample.x[i];
      }
    }
    const scale = 1 / samples.length;
    for (let i = 0; i < weights.length; i += 1) {
      weights[i] -= lr * grad[i] * scale;
    }
  }
  return weights;
}

function toWeights(raw: number[]): Weights {
  return {
    bias: raw[0],
    wMoves: raw[1],
    wScorePerMove: raw[2],
    wMaxTilePerMove: raw[3],
    wEntropy: raw[4],
    wBoardSize: raw[5],
    wTier: raw[6]
  };
}

function evalMetrics(samples: Sample[], scoreWeights: number[], maxTileWeights: number[]) {
  if (samples.length === 0) return { scoreMae: 0, scoreRmse: 0, maxMae: 0, maxRmse: 0 };
  let scoreAbs = 0;
  let scoreSq = 0;
  let maxAbs = 0;
  let maxSq = 0;
  for (const sample of samples) {
    const scoreErr = predict(scoreWeights, sample.x) - sample.yScore;
    const maxErr = predict(maxTileWeights, sample.x) - sample.yMaxTile;
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

export function runOfflineBaseline(rows: MlFeatureInput[]): MlBaselineReport {
  const { train, test } = splitTrainTest(rows);
  const trainSamples = train.map((row) => ({
    x: features(row),
    yScore: row.labelScore,
    yMaxTile: row.labelMaxTile
  }));
  const testSamples = test.map((row) => ({
    x: features(row),
    yScore: row.labelScore,
    yMaxTile: row.labelMaxTile
  }));

  const scoreWeights = fitLinearGd(trainSamples, "yScore");
  const maxWeights = fitLinearGd(trainSamples, "yMaxTile");
  const metrics = evalMetrics(testSamples, scoreWeights, maxWeights);

  return {
    model: "linear-gd-v1",
    trainCount: train.length,
    testCount: test.length,
    score: { mae: metrics.scoreMae, rmse: metrics.scoreRmse },
    maxTile: { mae: metrics.maxMae, rmse: metrics.maxRmse }
  };
}

export function explainWeightsForDebug(rows: MlFeatureInput[]) {
  const samples = rows.map((row) => ({
    x: features(row),
    yScore: row.labelScore,
    yMaxTile: row.labelMaxTile
  }));
  return {
    score: toWeights(fitLinearGd(samples, "yScore")),
    maxTile: toWeights(fitLinearGd(samples, "yMaxTile"))
  };
}
