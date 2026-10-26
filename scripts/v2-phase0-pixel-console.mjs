#!/usr/bin/env node

import http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const WebSocket = require("next/dist/compiled/ws");

const endpoint = process.env.BINARY2048_CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const action = process.argv[2];

const expressions = {
  reload: `(() => {
    setTimeout(() => location.reload(), 100);
    return { scheduled: true };
  })()`,
  status: `(() => {
    const meta = [...document.querySelectorAll('.meta span')].map(node => node.textContent?.trim() ?? '');
    const moves = Number(meta.find(text => text.startsWith('Moves:'))?.slice(6).trim() ?? NaN);
    const build = document.querySelector('.build-version')?.textContent?.trim() ?? '';
    return {
      page: document.title === 'Binary 2048',
      portrait: matchMedia('(orientation: portrait)').matches,
      authenticated: document.querySelector('.auth-shell')?.dataset.authenticated === 'true',
      commit: build.match(/\\(([^)]+)\\)/)?.[1] ?? null,
      gameReady: Boolean(document.querySelector('[aria-label="Binary 2048 game board"]')) && meta.some(text => text === 'Active'),
      moves: Number.isFinite(moves) ? moves : null,
      busy: document.querySelector('.card')?.getAttribute('aria-busy') === 'true',
      completed: performance.getEntriesByName('binary2048:move-complete').length,
      dropped: performance.getEntriesByName('binary2048:move-dropped').length
    };
  })()`,
  clear: `(() => {
    performance.clearMarks('binary2048:move-complete');
    performance.clearMarks('binary2048:move-dropped');
    performance.clearMeasures('binary2048:move-input-to-next-frame');
    performance.clearResourceTimings();
    return { completed: 0, dropped: 0, resources: performance.getEntriesByType('resource').length };
  })()`,
  counts: `(() => ({
    completed: performance.getEntriesByName('binary2048:move-complete').length,
    dropped: performance.getEntriesByName('binary2048:move-dropped').length,
    moveResources: performance.getEntriesByType('resource').filter(entry => {
      const url = new URL(entry.name);
      return url.origin === location.origin && /\\/api\\/games\\/[^/]+\\/move$/.test(url.pathname);
    }).length
  }))()`,
  extract: `(() => {
    const round = n => Math.round(n * 100) / 100;
    const allowed = new Set(['rate_limit_identity','rate_limit_counter','request_parse','session_lookup','recovery_verify','recovery_replay','recovery_import','engine_move','session_persist','snapshot_build','snapshot_sign','response_encode','total']);
    const required = ['rate_limit_identity','rate_limit_counter','request_parse','session_lookup','engine_move','session_persist','snapshot_build','snapshot_sign','response_encode','total'];
    const completed = performance.getEntriesByName('binary2048:move-complete').map(entry => {
      const detail = entry.detail || {};
      const phases = Array.isArray(detail.phases) ? detail.phases : [];
      const first = phases.find(phase => phase.phase === 'input_capture');
      const last = phases.find(phase => phase.phase === 'next_animation_frame');
      return {
        source: detail.source,
        disposition: phases.some(phase => phase.phase === 'queued') ? 'queued' : 'accepted',
        queueDepths: Array.isArray(detail.queueDepthSamples)
          ? detail.queueDepthSamples.map(sample => ({ stage: sample.stage, depth: sample.depth })) : [],
        inputToNextFrameMs: first && last ? round(last.atMs - first.atMs) : null
      };
    });
    const dropped = performance.getEntriesByName('binary2048:move-dropped').map(entry => ({
      source: entry.detail?.source,
      disposition: 'dropped',
      reason: entry.detail?.dropReason,
      queueDepths: Array.isArray(entry.detail?.queueDepthSamples)
        ? entry.detail.queueDepthSamples.map(sample => ({ stage: sample.stage, depth: sample.depth })) : []
    }));
    const resources = performance.getEntriesByType('resource').filter(entry => {
      const url = new URL(entry.name);
      return url.origin === location.origin && /\\/api\\/games\\/[^/]+\\/move$/.test(url.pathname);
    });
    const serverTimings = resources.map(resource => {
      const result = {};
      for (const metric of resource.serverTiming || []) {
        if (!allowed.has(metric.name) || metric.name in result || !Number.isFinite(metric.duration) || metric.duration < 0) throw new Error('Invalid Server-Timing projection');
        result[metric.name] = round(metric.duration);
      }
      if (required.some(name => !(name in result))) throw new Error('Missing required Server-Timing metric');
      return result;
    });
    if (serverTimings.length !== completed.length) throw new Error('Client/server sample count mismatch');
    const values = completed.map(entry => entry.inputToNextFrameMs).filter(Number.isFinite).sort((a, b) => a - b);
    const nearest = percentile => values.length ? values[Math.max(0, Math.ceil(values.length * percentile) - 1)] : null;
    return {
      capturedValidGestures: completed.length + dropped.length,
      accepted: completed.filter(entry => entry.disposition === 'accepted').length,
      queued: completed.filter(entry => entry.disposition === 'queued').length,
      dropped: dropped.length,
      droppedByReason: dropped.reduce((result, entry) => ((result[entry.reason] = (result[entry.reason] || 0) + 1), result), {}),
      inputToNextFrameMs: { median: nearest(.5), p95: nearest(.95) },
      events: completed.map((event, index) => ({ ...event, serverTimingMs: serverTimings[index] })).concat(dropped)
    };
  })()`
};

if (!(action in expressions)) {
  console.error("Usage: node scripts/v2-phase0-pixel-console.mjs <reload|status|clear|counts|extract>");
  process.exit(2);
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    const request = http.get(`${endpoint}${path}`, response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { body += chunk; });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

const version = await getJson("/json/version");
if (typeof version.webSocketDebuggerUrl !== "string") {
  throw new Error("Pixel Chrome did not provide a browser debugging endpoint");
}

const socket = new WebSocket(version.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();

socket.on("message", data => {
  const message = JSON.parse(data.toString());
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Pixel Chrome debugging approval timed out")), 55_000);
  socket.once("open", () => {
    clearTimeout(timer);
    resolve();
  });
  socket.once("error", error => {
    clearTimeout(timer);
    reject(error);
  });
  socket.once("unexpected-response", (_request, response) => {
    clearTimeout(timer);
    reject(new Error(`Chrome rejected browser debugging with HTTP ${response.statusCode}`));
  });
});

function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, 10_000);
    pending.set(id, {
      resolve: value => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: error => {
        clearTimeout(timer);
        reject(error);
      }
    });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

const { targetInfos } = await command("Target.getTargets");
const matches = targetInfos.filter(target =>
  target.type === "page" &&
  target.title === "Binary 2048" &&
  target.url === "https://www.binary2048.com/"
);
if (matches.length !== 1) {
  socket.close();
  throw new Error(`Expected exactly one Binary 2048 production tab; found ${matches.length}`);
}

const { sessionId } = await command("Target.attachToTarget", {
  targetId: matches[0].targetId,
  flatten: true
});
const evaluation = await command("Runtime.evaluate", {
  expression: expressions[action],
  returnByValue: true,
  awaitPromise: true
}, sessionId);
await command("Target.detachFromTarget", { sessionId });
socket.close();

if (evaluation.exceptionDetails) {
  throw new Error(evaluation.exceptionDetails.exception?.description ?? "Chrome evaluation failed");
}
const result = evaluation.result?.value;

console.log(JSON.stringify(result, null, 2));
