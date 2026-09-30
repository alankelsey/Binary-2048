#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";

const datasetDirectory = path.resolve(
  process.env.RESEARCH_DATASET_DIR ?? "data/model-benchmark",
);
const manifestPath = path.join(datasetDirectory, "manifest.json");
const releaseManifestPath = path.join(datasetDirectory, "release-manifest.json");
const forbiddenKeys = new Set([
  "authorization",
  "cookie",
  "email",
  "password",
  "playerid",
  "secret",
  "userid",
]);
const forbiddenValues = [
  /mongodb(?:\+srv)?:\/\//iu,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
];

function fail(message) {
  throw new Error(`[research-release-audit] ${message}`);
}

function inspectValue(value, location) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectValue(entry, `${location}[${index}]`));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase().replaceAll(/[^a-z0-9]/gu, "");
      if (forbiddenKeys.has(normalizedKey)) {
        fail(`forbidden field ${location}.${key}`);
      }
      inspectValue(entry, `${location}.${key}`);
    }
    return;
  }

  if (typeof value === "string") {
    for (const pattern of forbiddenValues) {
      if (pattern.test(value)) {
        fail(`sensitive value pattern at ${location}`);
      }
    }
  }
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const releaseManifest = JSON.parse(await readFile(releaseManifestPath, "utf8"));
  const expectedFiles = Object.values(manifest.files ?? {}).flatMap(Object.values);
  const checksums = manifest.sha256 ?? {};

  if (expectedFiles.length === 0) fail("manifest has no dataset files");

  for (const filename of expectedFiles) {
    if (path.basename(filename) !== filename) {
      fail(`manifest file must be a basename: ${filename}`);
    }
    const expectedChecksum = checksums[filename];
    if (!expectedChecksum) fail(`missing checksum for ${filename}`);
    const actualChecksum = await sha256(path.join(datasetDirectory, filename));
    if (actualChecksum !== expectedChecksum) fail(`checksum mismatch for ${filename}`);
  }

  const canonicalRows = {};
  for (const [split, filename] of Object.entries(manifest.files?.jsonl ?? {})) {
    const content = await readFile(path.join(datasetDirectory, filename), "utf8");
    const lines = content.trim().split("\n").filter(Boolean);
    const expectedRows = manifest.rows?.[split];
    if (lines.length !== expectedRows) {
      fail(`${filename} has ${lines.length} rows; manifest records ${expectedRows}`);
    }
    canonicalRows[split] = lines.map((line, index) => {
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        fail(`${filename}:${index + 1} is not valid JSON`);
      }
      inspectValue(row, `${filename}:${index + 1}`);
      return row;
    });
  }

  for (const [split, filename] of Object.entries(manifest.files?.parquet ?? {})) {
    if (!filename) continue;
    const rows = await parquetReadObjects({
      file: await asyncBufferFromFile(path.join(datasetDirectory, filename)),
    });
    const expectedRows = canonicalRows[split];
    if (!expectedRows || rows.length !== expectedRows.length) {
      fail(`${filename} has ${rows.length} rows; canonical split has ${expectedRows?.length ?? 0}`);
    }
    const embeddedColumn = split === "metrics" ? "record_json" : "step_json";
    rows.forEach((row, index) => {
      inspectValue(row, `${filename}:${index + 1}`);
      let embedded;
      try {
        embedded = JSON.parse(row[embeddedColumn]);
      } catch {
        fail(`${filename}:${index + 1}.${embeddedColumn} is not valid JSON`);
      }
      if (JSON.stringify(embedded) !== JSON.stringify(expectedRows[index])) {
        fail(`${filename}:${index + 1} does not match its canonical JSONL row`);
      }
    });
  }

  const expectedReleaseFiles = Object.entries(manifest.files?.parquet ?? {})
    .filter(([, filename]) => Boolean(filename))
    .map(([split, filename]) => [filename, manifest.rows?.[split]])
    .sort(([left], [right]) => left.localeCompare(right));
  const actualReleaseFiles = Object.entries(releaseManifest.files ?? {})
    .map(([filename, metadata]) => [filename, metadata?.rows])
    .sort(([left], [right]) => left.localeCompare(right));
  if (JSON.stringify(actualReleaseFiles) !== JSON.stringify(expectedReleaseFiles)) {
    fail("release manifest must allowlist exactly the generated Parquet files and row counts");
  }
  for (const [filename] of expectedReleaseFiles) {
    if (releaseManifest.files[filename].sha256 !== manifest.sha256?.[filename]) {
      fail(`release checksum does not match canonical manifest for ${filename}`);
    }
  }
  for (const document of releaseManifest.documents ?? []) {
    await readFile(path.resolve(datasetDirectory, document));
  }

  console.log(
    `Research dataset audit passed: ${expectedFiles.length} files, ` +
      `${Object.values(manifest.rows).reduce((sum, count) => sum + count, 0)} canonical rows.`,
  );
  console.log("Repository-history, ownership, and licensing review remain manual gates.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
