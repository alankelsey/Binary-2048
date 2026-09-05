#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { correctFallbackObjectives, renderChallengeReport, summarizeChallengeRecords } from "./challenge-benchmark-lib.mjs";

const corpusPath = process.env.CHALLENGE_CORPUS ?? "data/model-benchmark/challenge-corpus.v1.json";
const ledgerPath = process.env.CHALLENGE_RUN_LEDGER ?? "docs/challenge-benchmark-runs.json";
const reportPath = process.env.CHALLENGE_REPORT ?? "docs/challenge-benchmark-latest.md";

const corpus = JSON.parse(await readFile(corpusPath, "utf8"));
const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
const records = ledger.filter((record) => record.track === "curated-fixed-board" && record.corpus?.id === corpus.corpusId && record.corpus?.version === corpus.corpusVersion);
const correctedFallbackObjectives = correctFallbackObjectives(records);
if (correctedFallbackObjectives > 0) await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderChallengeReport(corpus, records), "utf8");
console.log(JSON.stringify({ ok: true, correctedFallbackObjectives, report: reportPath, summary: summarizeChallengeRecords(records) }, null, 2));
