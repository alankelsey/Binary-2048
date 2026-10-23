#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { researchRequestHeaders } from "./research-client-auth.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const BATCH_FILE = process.env.BATCH_FILE ?? "";

if (!BATCH_FILE) {
  console.error("[replay:ingest:worker] BATCH_FILE is required");
  process.exit(1);
}

function loadBatch(path) {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.records)) {
    throw new Error("batch file must contain { records: [...] }");
  }
  return parsed.records;
}

function boundedBatches(records) {
  const batches = [];
  let current = [];
  for (const record of records) {
    const candidate = [...current, record];
    if (candidate.length > 100 || Buffer.byteLength(JSON.stringify({ records: candidate })) > 900 * 1024) {
      if (current.length === 0) throw new Error("one record exceeds the 900 KiB client request cap");
      batches.push(current);
      current = [record];
    } else {
      current = candidate;
    }
  }
  if (current.length) batches.push(current);
  return batches;
}

async function requestJson(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON from ${path}: ${text.slice(0, 240)}`);
  }
  if (!res.ok) {
    const message = typeof json?.error === "string" ? json.error : `HTTP ${res.status}`;
    throw new Error(`${path} failed: ${message}`);
  }
  return json;
}

async function main() {
  const records = loadBatch(BATCH_FILE);
  const batches = boundedBatches(records);
  let ingested = 0;
  const duplicateIds = new Set();
  for (const batch of batches) {
    const response = await requestJson("/api/replay/ingest", {
      method: "POST",
      headers: researchRequestHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ records: batch })
    });
    ingested += Number(response.ingested ?? 0);
    for (const id of response.duplicateIds ?? []) duplicateIds.add(id);
  }
  console.log(
    JSON.stringify(
      {
        base: BASE,
        batchFile: BATCH_FILE,
        recordCount: records.length,
        requestCount: batches.length,
        ingested,
        duplicateIds: [...duplicateIds]
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(`[replay:ingest:worker] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
