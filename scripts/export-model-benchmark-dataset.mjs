#!/usr/bin/env node

import { exportBenchmarkLedger } from "./model-benchmark-export-lib.mjs";

const ledgerPath = process.env.BENCHMARK_LEDGER ?? "docs/hf-benchmark-runs.json";
const outDirectory = process.env.OUT_DIR ?? "data/model-benchmark";

exportBenchmarkLedger({ ledgerPath, outDirectory })
  .then((manifest) => console.log(JSON.stringify(manifest, null, 2)))
  .catch((error) => {
    console.error(`[benchmark:export] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
