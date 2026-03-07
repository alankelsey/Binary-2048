#!/usr/bin/env node

const BASE = process.env.BASE ?? "http://localhost:3000";
const SEEDS = (process.env.BENCH_SEEDS ?? "100,101,102,103,104")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n));
const MAX_MOVES = Number(process.env.MAX_MOVES ?? "250");

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

function toMarkdown(result) {
  const lines = [];
  lines.push("# Bot Benchmark (Latest)");
  lines.push("");
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Target: ${BASE}`);
  lines.push(`- Seeds: ${SEEDS.join(", ")}`);
  lines.push(`- Max moves: ${MAX_MOVES}`);
  lines.push("");
  lines.push("| Bot | Avg Score | Avg Moves | Avg Max Tile | Wins |");
  lines.push("|---|---:|---:|---:|---:|");
  for (const r of result.ranking ?? []) {
    lines.push(`| ${r.bot} | ${r.avgScore} | ${r.avgMoves} | ${r.avgMaxTile} | ${r.wins} |`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const result = await requestJson("/api/bots/tournament", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      seeds: SEEDS,
      maxMoves: MAX_MOVES,
      bots: ["priority", "random", "alternate"]
    })
  });

  const md = toMarkdown(result);
  const out = "docs/bot-benchmark-latest.md";
  const fs = await import("node:fs/promises");
  await fs.writeFile(out, md, "utf8");
  console.log(md);
}

main().catch((error) => {
  console.error(`[bot:benchmark] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
