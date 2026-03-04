#!/usr/bin/env node
import { readFileSync } from "fs";

const filePath = process.argv[2] || "docs/roadmap-checklist.md";
const markdown = readFileSync(filePath, "utf8");
const lines = markdown.split(/\r?\n/);
const checkboxRe = /^\s*-\s\[( |x|X)\]\s+/;
let total = 0;
let done = 0;

for (const line of lines) {
  const match = line.match(checkboxRe);
  if (!match) continue;
  total += 1;
  if (match[1].toLowerCase() === "x") done += 1;
}

const progress = {
  total,
  done,
  percent: total === 0 ? 0 : Math.round((done / total) * 100)
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(progress));
} else {
  console.log(`Roadmap progress: ${progress.percent}% (${progress.done}/${progress.total})`);
}
