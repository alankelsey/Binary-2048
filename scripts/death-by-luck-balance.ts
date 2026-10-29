import {
  runDeathByLuckBalanceExperiment,
  runDeathByLuckFixedSeedExperiment
} from "../lib/binary2048/death-by-luck-balance";

const summaries = runDeathByLuckBalanceExperiment();
const fixedSeedRuns = runDeathByLuckFixedSeedExperiment();
process.stdout.write(`${JSON.stringify({
  experiment: "death-by-luck-balance-v1",
  generatedAtISO: new Date().toISOString(),
  seeds: { start: 20_000, runsPerCandidate: 200 },
  moveCap: 600,
  winTile: 2048,
  policy: "greedy score, then empty cells, then max tile; stable left/down/right/up tie-break",
  fixedSeedRuns,
  summaries
}, null, 2)}\n`);
