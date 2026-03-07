#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'fs';
import { performance } from 'perf_hooks';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const STAGES = [
  { name: 'baseline', concurrency: 8, iterations: 80 },
  { name: 'ramp', concurrency: 16, iterations: 160 },
  { name: 'stress-lite', concurrency: 24, iterations: 240 }
];

const SLO = {
  p95Ms: Number(process.env.SLO_P95_MS || 400),
  errorRate: Number(process.env.SLO_ERROR_RATE || 0.01)
};

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function randomDir() {
  const dirs = ['left', 'up', 'right', 'down'];
  return dirs[Math.floor(Math.random() * dirs.length)];
}

async function jsonPost(path, body) {
  const started = performance.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const elapsedMs = performance.now() - started;
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  return { status: res.status, elapsedMs, body: parsed };
}

async function runOne() {
  const create = await jsonPost('/api/games', {});
  if (create.status !== 200 || !create.body?.id) {
    return {
      ok: false,
      createMs: create.elapsedMs,
      moveMs: 0,
      createStatus: create.status,
      moveStatus: 0,
      totalMs: create.elapsedMs
    };
  }

  const move = await jsonPost(`/api/games/${create.body.id}/move`, { dir: randomDir() });
  const moveOk = move.status === 200 || move.status === 409;
  return {
    ok: moveOk,
    createMs: create.elapsedMs,
    moveMs: move.elapsedMs,
    createStatus: create.status,
    moveStatus: move.status,
    totalMs: create.elapsedMs + move.elapsedMs
  };
}

async function runStage(stage) {
  const startedAt = new Date().toISOString();
  const runStarted = performance.now();
  const queue = Array.from({ length: stage.iterations }, (_, i) => i);
  const results = [];

  async function worker() {
    while (queue.length > 0) {
      queue.pop();
      const result = await runOne();
      results.push(result);
    }
  }

  await Promise.all(Array.from({ length: stage.concurrency }, () => worker()));

  const elapsedMs = performance.now() - runStarted;
  const successes = results.filter((r) => r.ok).length;
  const failures = results.length - successes;
  const errorRate = results.length ? failures / results.length : 1;

  const createMs = results.map((r) => r.createMs);
  const moveMs = results.map((r) => r.moveMs).filter((v) => v > 0);
  const totalMs = results.map((r) => r.totalMs);

  const metrics = {
    requests: results.length,
    successes,
    failures,
    errorRate,
    durationMs: elapsedMs,
    throughputRps: results.length / (elapsedMs / 1000),
    create: {
      p50: percentile(createMs, 50),
      p95: percentile(createMs, 95),
      avg: avg(createMs)
    },
    move: {
      p50: percentile(moveMs, 50),
      p95: percentile(moveMs, 95),
      avg: avg(moveMs)
    },
    total: {
      p50: percentile(totalMs, 50),
      p95: percentile(totalMs, 95),
      avg: avg(totalMs)
    }
  };

  const passed = metrics.total.p95 < SLO.p95Ms && errorRate < SLO.errorRate;

  return {
    stage: stage.name,
    startedAt,
    finishedAt: new Date().toISOString(),
    config: stage,
    slo: SLO,
    passed,
    metrics
  };
}

async function main() {
  console.log(`Running staged gameplay load test against ${BASE_URL}`);
  const stageResults = [];
  for (const stage of STAGES) {
    console.log(`-> stage=${stage.name} concurrency=${stage.concurrency} iterations=${stage.iterations}`);
    const result = await runStage(stage);
    stageResults.push(result);
    console.log(
      `   ${result.passed ? 'PASS' : 'FAIL'} p95=${result.metrics.total.p95.toFixed(1)}ms errorRate=${(
        result.metrics.errorRate *
        100
      ).toFixed(2)}% rps=${result.metrics.throughputRps.toFixed(2)}`
    );
  }

  const overallPass = stageResults.every((result) => result.passed);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    overallPass,
    stages: stageResults
  };

  mkdirSync('docs/load-results', { recursive: true });
  writeFileSync('docs/load-results/staged-gameplay-latest.json', JSON.stringify(report, null, 2));

  const md = [
    '# Staged Gameplay Load Result (Latest)',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Target: ${BASE_URL}`,
    `- Overall: ${overallPass ? 'PASS' : 'FAIL'}`,
    ''
  ];

  for (const stage of stageResults) {
    md.push(`## ${stage.stage}`);
    md.push('');
    md.push(`- Config: concurrency=${stage.config.concurrency}, iterations=${stage.config.iterations}`);
    md.push(`- Result: ${stage.passed ? 'PASS' : 'FAIL'}`);
    md.push(`- Error rate: ${(stage.metrics.errorRate * 100).toFixed(2)}%`);
    md.push(`- Total p95: ${stage.metrics.total.p95.toFixed(1)}ms`);
    md.push(`- Throughput: ${stage.metrics.throughputRps.toFixed(2)} req/s`);
    md.push('');
  }

  writeFileSync('docs/load-results/staged-gameplay-latest.md', md.join('\n'));

  if (!overallPass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
