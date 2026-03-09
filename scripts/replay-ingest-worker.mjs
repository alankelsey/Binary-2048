#!/usr/bin/env node

import { readFileSync } from "node:fs";

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
  const response = await requestJson("/api/replay/ingest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ records })
  });
  console.log(
    JSON.stringify(
      {
        base: BASE,
        batchFile: BATCH_FILE,
        recordCount: records.length,
        ...response
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

