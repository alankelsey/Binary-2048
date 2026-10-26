#!/usr/bin/env node

import http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const WebSocket = require("next/dist/compiled/ws");
const endpoint = process.env.BINARY2048_CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const targetUrl = process.env.BINARY2048_PIXEL_URL ?? "https://www.binary2048.com/";
const runs = Number(process.env.BINARY2048_STARTUP_RUNS ?? 5);
const expectedCommit = process.env.BINARY2048_EXPECT_COMMIT;

if (!Number.isInteger(runs) || runs < 3 || runs > 10) {
  throw new Error("BINARY2048_STARTUP_RUNS must be an integer from 3 through 10");
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

function round(value) {
  return Math.round(value * 100) / 100;
}

function percentile(values, percent) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * percent / 100) - 1)];
}

function summarize(samples, key) {
  const values = samples.map(sample => sample[key]);
  return {
    medianMs: round(percentile(values, 50)),
    p95Ms: round(percentile(values, 95)),
    minMs: round(Math.min(...values)),
    maxMs: round(Math.max(...values))
  };
}

const version = await getJson("/json/version");
if (typeof version.webSocketDebuggerUrl !== "string") {
  throw new Error("Pixel Chrome did not provide a browser debugging endpoint");
}
const chromeMajorMatch = String(version.Browser ?? "").match(/Chrome\/(\d+)/);

const socket = new WebSocket(version.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();
const eventWaiters = new Map();

socket.on("message", data => {
  const message = JSON.parse(data.toString());
  if (message.method) {
    const waiters = eventWaiters.get(message.method) ?? [];
    eventWaiters.delete(message.method);
    waiters.forEach(resolve => resolve(message.params));
  }
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject, timer } = pending.get(message.id);
  clearTimeout(timer);
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
});

function command(method, params = {}, sessionId, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

function waitForEvent(method, timeoutMs = 20_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const waiters = eventWaiters.get(method) ?? [];
      eventWaiters.set(method, waiters.filter(waiter => waiter !== onEvent));
      reject(new Error(`${method} timed out`));
    }, timeoutMs);
    const onEvent = value => {
      clearTimeout(timer);
      resolve(value);
    };
    eventWaiters.set(method, [...(eventWaiters.get(method) ?? []), onEvent]);
  });
}

const { targetInfos } = await command("Target.getTargets");
const matches = targetInfos.filter(target =>
  target.type === "page" && target.title === "Binary 2048" && target.url === targetUrl
);
if (matches.length !== 1) {
  socket.close();
  throw new Error(`Expected exactly one Binary 2048 tab at ${targetUrl}; found ${matches.length}`);
}

const { sessionId } = await command("Target.attachToTarget", {
  targetId: matches[0].targetId,
  flatten: true
});
await command("Page.enable", {}, sessionId);

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    returnByValue: true
  }, sessionId);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? "Pixel evaluation failed");
  }
  return result.result?.value;
}

async function waitForReady() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const ready = await evaluate(`(() => ({
        shell: performance.getEntriesByName('binary2048:game-shell-ready').length === 1,
        auth: performance.getEntriesByName('binary2048:auth-hydration-complete').length === 1,
        portrait: matchMedia('(orientation: portrait)').matches,
        visibility: document.visibilityState
      }))()`);
      if (ready?.shell && ready?.auth) return ready;
    } catch {
      // The execution context is briefly unavailable while the page reloads.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for game-shell and auth-hydration marks");
}

const samples = [];
let deployedCommit;
try {
  for (let index = 0; index < runs; index += 1) {
    const loaded = waitForEvent("Page.loadEventFired");
    await command("Page.reload", { ignoreCache: true }, sessionId);
    await loaded;
    const ready = await waitForReady();
    if (!ready.portrait || ready.visibility !== "visible") {
      throw new Error(`Pixel tab is not ready for startup measurement: ${JSON.stringify(ready)}`);
    }
    const sample = await evaluate(`(() => {
      const mark = name => performance.getEntriesByName(name)[0]?.startTime;
      const nav = performance.getEntriesByType('navigation')[0];
      const paint = name => performance.getEntriesByName(name)[0]?.startTime;
      const versionText = document.querySelector('[aria-label="app version"]')?.textContent ?? '';
      const commit = versionText.match(/\\(([a-f0-9]{7,40}|dev)\\)/)?.[1];
      return {
        commit,
        responseStartMs: nav?.responseStart,
        domContentLoadedMs: nav?.domContentLoadedEventEnd,
        loadMs: nav?.loadEventEnd,
        firstContentfulPaintMs: paint('first-contentful-paint'),
        gameShellReadyMs: mark('binary2048:game-shell-ready'),
        authHydrationStartMs: mark('binary2048:auth-hydration-start'),
        authHydrationCompleteMs: mark('binary2048:auth-hydration-complete')
      };
    })()`);
    const numericKeys = [
      "responseStartMs", "domContentLoadedMs", "loadMs", "firstContentfulPaintMs",
      "gameShellReadyMs", "authHydrationStartMs", "authHydrationCompleteMs"
    ];
    if (!sample?.commit || numericKeys.some(key => !Number.isFinite(sample[key]) || sample[key] < 0)) {
      throw new Error(`Invalid startup sample: ${JSON.stringify(sample)}`);
    }
    deployedCommit ??= sample.commit;
    if (sample.commit !== deployedCommit) throw new Error("Deployed commit changed during capture");
    samples.push({
      run: index + 1,
      ...Object.fromEntries(numericKeys.map(key => [key, round(sample[key])])),
      shellBeforeAuthCompleteMs: round(sample.authHydrationCompleteMs - sample.gameShellReadyMs)
    });
  }
} finally {
  try {
    await command("Target.detachFromTarget", { sessionId });
  } finally {
    socket.close();
  }
}

if (expectedCommit && deployedCommit !== expectedCommit &&
    !expectedCommit.startsWith(deployedCommit) && !deployedCommit.startsWith(expectedCommit)) {
  throw new Error(`Expected deployed commit ${expectedCommit}, received ${deployedCommit}`);
}

console.log(JSON.stringify({
  schemaVersion: 1,
  context: {
    target: "Binary 2048 production root",
    device: "Pixel 10 Pro XL",
    chromeMajor: chromeMajorMatch?.[1] ?? "unknown",
    orientation: "portrait",
    authenticated: false,
    deployedCommit,
    cacheMode: "reload with cache bypassed",
    metricLimit: "Chrome navigation and User Timing entries; not server-only timing"
  },
  samples,
  summary: {
    responseStart: summarize(samples, "responseStartMs"),
    firstContentfulPaint: summarize(samples, "firstContentfulPaintMs"),
    gameShellReady: summarize(samples, "gameShellReadyMs"),
    authHydrationComplete: summarize(samples, "authHydrationCompleteMs"),
    shellBeforeAuthComplete: summarize(samples, "shellBeforeAuthCompleteMs")
  }
}, null, 2));
