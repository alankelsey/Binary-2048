#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'fs';
import { performance } from 'perf_hooks';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CONCURRENCY = Number(process.env.ABUSE_CONCURRENCY || 12);
const ITERATIONS = Number(process.env.ABUSE_ITERATIONS || 180);

const ALLOWED_STATUS = new Set([200, 400, 401, 403, 404, 409, 413, 429, 503]);

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

function sampleScenario() {
  const x = Math.random();
  if (x < 0.25) {
    return {
      kind: 'simulate_invalid_move',
      path: '/api/simulate',
      body: { seed: 42, moves: ['BAD', 'NOPE'], config: { size: 4 } }
    };
  }
  if (x < 0.5) {
    return {
      kind: 'simulate_oversized_payload',
      path: '/api/simulate',
      body: {
        seed: 42,
        moves: Array.from({ length: 8000 }, () => 'L'),
        config: { size: 4 }
      }
    };
  }
  if (x < 0.75) {
    return {
      kind: 'tournament_oversized',
      path: '/api/bots/tournament',
      body: {
        seedStart: 1,
        seedCount: 5000,
        maxMoves: 50000,
        bots: ['priority', 'random', 'alternate']
      }
    };
  }
  return {
    kind: 'tournament_bounded',
    path: '/api/bots/tournament',
    body: {
      seedStart: 100,
      seedCount: 4,
      maxMoves: 128,
      bots: ['priority', 'random', 'alternate']
    }
  };
}

async function postJson(path, body) {
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
  const scenario = sampleScenario();
  const result = await postJson(scenario.path, scenario.body);
  const allowed = ALLOWED_STATUS.has(result.status);
  return {
    ...scenario,
    status: result.status,
    elapsedMs: result.elapsedMs,
    allowed,
    is5xx: result.status >= 500 && result.status <= 599
  };
}

async function main() {
  console.log(`Running heavy abuse test against ${BASE_URL}`);
  console.log(`concurrency=${CONCURRENCY} iterations=${ITERATIONS}`);

  const queue = Array.from({ length: ITERATIONS }, (_, i) => i);
  const results = [];

  async function worker() {
    while (queue.length > 0) {
      queue.pop();
      const result = await runOne();
      results.push(result);
    }
  }

  const started = performance.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  const durationMs = performance.now() - started;

  const statusCounts = {};
  const kindCounts = {};
  for (const item of results) {
    statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
    kindCounts[item.kind] = (kindCounts[item.kind] || 0) + 1;
  }

  const disallowed = results.filter((r) => !r.allowed);
  const fiveXx = results.filter((r) => r.is5xx).length;
  const errorRate5xx = results.length ? fiveXx / results.length : 1;

  const metrics = {
    requests: results.length,
    durationMs,
    throughputRps: results.length / (durationMs / 1000),
    p50Ms: percentile(results.map((r) => r.elapsedMs), 50),
    p95Ms: percentile(results.map((r) => r.elapsedMs), 95),
    avgMs: avg(results.map((r) => r.elapsedMs)),
    fiveXx,
    fiveXxRate: errorRate5xx,
    disallowedResponses: disallowed.length,
    statusCounts,
    kindCounts
  };

  const passed = disallowed.length === 0 && errorRate5xx < 0.02;

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    concurrency: CONCURRENCY,
    iterations: ITERATIONS,
    allowedStatuses: [...ALLOWED_STATUS].sort((a, b) => a - b),
    passed,
    metrics
  };

  mkdirSync('docs/load-results', { recursive: true });
  writeFileSync('docs/load-results/heavy-abuse-latest.json', JSON.stringify(report, null, 2));

  const md = [
    '# Heavy Route Abuse Result (Latest)',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Target: ${BASE_URL}`,
    `- Concurrency: ${CONCURRENCY}`,
    `- Iterations: ${ITERATIONS}`,
    `- Overall: ${passed ? 'PASS' : 'FAIL'}`,
    '',
    `- p95: ${metrics.p95Ms.toFixed(1)}ms`,
    `- 5xx rate: ${(metrics.fiveXxRate * 100).toFixed(2)}%`,
    `- Disallowed responses: ${metrics.disallowedResponses}`,
    '',
    '## Status counts',
    '',
    ...Object.entries(metrics.statusCounts)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([status, count]) => `- ${status}: ${count}`),
    '',
    '## Scenario counts',
    '',
    ...Object.entries(metrics.kindCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([kind, count]) => `- ${kind}: ${count}`)
  ];

  writeFileSync('docs/load-results/heavy-abuse-latest.md', md.join('\n'));

  console.log(
    `${passed ? 'PASS' : 'FAIL'} p95=${metrics.p95Ms.toFixed(1)}ms 5xxRate=${(
      metrics.fiveXxRate *
      100
    ).toFixed(2)}% disallowed=${metrics.disallowedResponses}`
  );

  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
