#!/usr/bin/env node

import http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const WebSocket = require("next/dist/compiled/ws");
const endpoint = process.env.BINARY2048_CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const targetUrl = process.env.BINARY2048_PIXEL_URL ?? "https://www.binary2048.com/";
const repeats = Number(process.env.BINARY2048_EFFECT_REPEATS ?? 8);
const requestedCase = process.argv[2] ?? "all";
const standardCaseNames = ["baseline", "merge-number", "merge-wild", "zero-bust", "spawn", "wild-shadow", "lock-shadow"];
const diagnosticCaseNames = ["merge-number-no-shadow", "merge-wild-no-filter", "merge-wild-no-shadow", "zero-bust-no-shadow", "spawn-no-shadow"];
const compositorCaseNames = ["merge-number-compositor", "merge-wild-compositor", "zero-bust-compositor"];
const caseNames = [...standardCaseNames, ...diagnosticCaseNames, ...compositorCaseNames];
const reducedMotionCheck = requestedCase === "reduced-motion-check";
const diagnosticRun = requestedCase === "diagnostics";
const compositorRun = requestedCase === "compositor-diagnostics";

if (process.argv.includes("--help")) {
  console.log(`Usage: node scripts/v2-phase6-pixel-effects.mjs [all|diagnostics|compositor-diagnostics|reduced-motion-check|${caseNames.join("|")}]

Attach to an already-open Binary 2048 Pixel Chrome tab through an adb-forwarded
CDP endpoint and print a privacy-safe aggregate paint/composite profile.

Environment:
  BINARY2048_CDP_ENDPOINT       CDP endpoint (default http://127.0.0.1:9222)
  BINARY2048_PIXEL_URL          exact target URL (default production root)
  BINARY2048_EFFECT_REPEATS     repetitions per case (default 8, range 5-20)`);
  process.exit(0);
}

if (!Number.isInteger(repeats) || repeats < 5 || repeats > 20) {
  throw new Error("BINARY2048_EFFECT_REPEATS must be an integer from 5 through 20");
}
if (requestedCase !== "all" && !diagnosticRun && !compositorRun && !reducedMotionCheck && !caseNames.includes(requestedCase)) {
  throw new Error(`Unknown case ${JSON.stringify(requestedCase)}; expected all, diagnostics, compositor-diagnostics, reduced-motion-check, or one of ${caseNames.join(", ")}`);
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

function nearestRank(values, percentile) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * percentile) - 1)];
}

function durations(events, predicate) {
  return events
    .filter(event => predicate(event) && Number.isFinite(event.dur))
    .map(event => event.dur / 1000);
}

function durationSummary(values, divisor = 1) {
  return {
    count: values.length,
    totalMs: round(values.reduce((sum, value) => sum + value, 0)),
    perActivationMs: round(values.reduce((sum, value) => sum + value, 0) / divisor),
    p95Ms: values.length ? round(nearestRank(values, 0.95)) : null,
    maxMs: values.length ? round(Math.max(...values)) : null
  };
}

function summarize(events, startName, endName) {
  const start = events.find(event => event.name === startName);
  const end = events.find(event => event.name === endName && (!start || event.ts >= start.ts));
  if (!start || !end || !Number.isFinite(start.ts) || !Number.isFinite(end.ts)) {
    throw new Error(`Trace did not contain the ${startName}/${endName} measurement boundary`);
  }
  const windowEvents = events.filter(event => Number.isFinite(event.ts) && event.ts >= start.ts && event.ts <= end.ts);
  const mainThreadEvents = windowEvents.filter(event => event.pid === start.pid && event.tid === start.tid);
  const rendererEvents = windowEvents.filter(event => event.pid === start.pid);
  const paint = durations(mainThreadEvents, event => event.name === "Paint");
  const composite = durations(mainThreadEvents, event => event.name === "CompositeLayers");
  const layerUpdate = durations(mainThreadEvents, event => event.name === "UpdateLayerTree");
  const raster = durations(rendererEvents, event => event.name === "RasterTask" || event.name === "RasterizerTaskImpl::RunOnWorkerThread");
  const longTasks = durations(mainThreadEvents, event =>
    (event.name === "RunTask" || event.name === "ThreadControllerImpl::RunTask") && event.dur >= 50_000
  );
  const drawFrameTimes = [...new Set(windowEvents
    .filter(event => event.name === "DrawFrame" && Number.isFinite(event.ts))
    .map(event => event.ts))].sort((a, b) => a - b);
  const frameGaps = drawFrameTimes.slice(1).map((time, index) => (time - drawFrameTimes[index]) / 1000);

  return {
    observationMs: round((end.ts - start.ts) / 1000),
    paint: durationSummary(paint, repeats),
    composite: durationSummary(composite, repeats),
    layerUpdate: durationSummary(layerUpdate, repeats),
    raster: durationSummary(raster, repeats),
    mainThreadLongTasksOver50Ms: longTasks.length,
    drawFramesObserved: drawFrameTimes.length,
    drawFrameGapMs: {
      p95: frameGaps.length ? round(nearestRank(frameGaps, 0.95)) : null,
      max: frameGaps.length ? round(Math.max(...frameGaps)) : null,
      over33_4Ms: frameGaps.filter(value => value > 33.4).length
    }
  };
}

const version = await getJson("/json/version");
if (typeof version.webSocketDebuggerUrl !== "string") {
  throw new Error("Pixel Chrome did not provide a browser debugging endpoint");
}

const socket = new WebSocket(version.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();
let activeTrace = null;

socket.on("message", data => {
  const message = JSON.parse(data.toString());
  if (message.method === "Tracing.dataCollected" && Array.isArray(message.params?.value) && activeTrace) {
    const remaining = activeTrace.limit - activeTrace.events.length;
    if (message.params.value.length > remaining) activeTrace.overflow = true;
    activeTrace.events.push(...message.params.value.slice(0, Math.max(0, remaining)));
    return;
  }
  if (message.method === "Tracing.tracingComplete" && activeTrace) {
    activeTrace.complete();
    return;
  }
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
});

function command(method, params = {}, sessionId, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, timeoutMs);
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
const matches = targetInfos.filter(target => target.type === "page" && target.title === "Binary 2048" && target.url === targetUrl);
if (matches.length !== 1) {
  socket.close();
  throw new Error(`Expected exactly one Binary 2048 tab at ${targetUrl}; found ${matches.length}`);
}
const { sessionId } = await command("Target.attachToTarget", { targetId: matches[0].targetId, flatten: true });
let output;

try {
const pageStatus = await command("Runtime.evaluate", {
  expression: `(() => ({
    board: Boolean(document.querySelector('[aria-label="Binary 2048 game board"]')),
    cells: document.querySelectorAll('[aria-label="Binary 2048 game board"] .cell').length,
    portrait: matchMedia('(orientation: portrait)').matches,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    visibility: document.visibilityState
  }))()`,
  returnByValue: true
}, sessionId);
const status = pageStatus.result?.value;
if (!status?.board || status.cells < 1 || !status.portrait || status.visibility !== "visible") {
  throw new Error(`Pixel tab is not ready for profiling: ${JSON.stringify(status)}`);
}
if (reducedMotionCheck) {
  if (!status.reducedMotion) {
    throw new Error("Enable Android Remove animations/reduced motion before running the reduced-motion check");
  }
  const check = await command("Runtime.evaluate", {
    expression: `(async () => {
      const cell = document.querySelector('[aria-label="Binary 2048 game board"] .cell');
      if (!(cell instanceof HTMLElement)) throw new Error('No check cell');
      const saved = { className: cell.className, style: cell.getAttribute('style'), html: cell.innerHTML, label: cell.getAttribute('aria-label') };
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const cases = [
        ['merge-number', 'cell filled tile-number fx-merge-number', '4'],
        ['merge-wild', 'cell filled tile-wild fx-merge-wild', '<span class="wild-icon">✦<small>2×</small></span>'],
        ['zero-bust', 'cell filled tile-zero fx-zero-bust', '0'],
        ['spawn', 'cell filled tile-number fx-spawn', '2']
      ];
      const result = [];
      try {
        cell.removeAttribute('style');
        cell.setAttribute('aria-label', 'temporary reduced-motion check cell');
        for (const [name, className, html] of cases) {
          cell.className = 'cell filled tile-number';
          cell.textContent = '4';
          void cell.offsetWidth;
          cell.className = className;
          cell.innerHTML = html;
          const style = getComputedStyle(cell);
          result.push({ name, animationName: style.animationName, animationDuration: style.animationDuration });
          await wait(900);
        }
        return result;
      } finally {
        cell.getAnimations().forEach(animation => animation.cancel());
        cell.className = saved.className;
        cell.innerHTML = saved.html;
        if (saved.style === null) cell.removeAttribute('style'); else cell.setAttribute('style', saved.style);
        if (saved.label === null) cell.removeAttribute('aria-label'); else cell.setAttribute('aria-label', saved.label);
      }
    })()`,
    returnByValue: true,
    awaitPromise: true
  }, sessionId);
  if (check.exceptionDetails) throw new Error(check.exceptionDetails.exception?.description ?? "Reduced-motion check failed");
  output = {
    schemaVersion: 1,
    context: { target: "Binary 2048 production root", orientation: "portrait", reducedMotion: true },
    cases: check.result?.value
  };
} else {
if (status.reducedMotion) {
  throw new Error("Disable Android Remove animations/reduced motion for the standard-effects profile; test reduced motion separately");
}

const selectedCases = requestedCase === "all"
  ? standardCaseNames
  : diagnosticRun
    ? diagnosticCaseNames
    : compositorRun
      ? compositorCaseNames
      : [requestedCase];
const results = {};
const traceCategories = "blink.user_timing,devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,cc,benchmark";

for (const caseName of selectedCases) {
  const events = [];
  let complete;
  const completed = new Promise(resolve => { complete = resolve; });
  activeTrace = { events, complete, completed, overflow: false, limit: 150_000, tracing: true };
  await command("Tracing.start", {
    categories: traceCategories,
    options: "record-as-much-as-possible",
    transferMode: "ReportEvents"
  });
  const startName = `binary2048:phase6:${caseName}:start`;
  const endName = `binary2048:phase6:${caseName}:end`;
  const run = await command("Runtime.evaluate", {
    expression: `(async () => {
      const cell = document.querySelector('[aria-label="Binary 2048 game board"] .cell');
      if (!(cell instanceof HTMLElement)) throw new Error('No profile cell');
      const saved = { className: cell.className, style: cell.getAttribute('style'), html: cell.innerHTML, label: cell.getAttribute('aria-label') };
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const frames = count => new Promise(resolve => {
        const next = () => count-- <= 0 ? resolve() : requestAnimationFrame(next);
        requestAnimationFrame(next);
      });
      const variants = {
        baseline: ['cell filled tile-number', '4'],
        'merge-number': ['cell filled tile-number', '4'],
        'merge-number-no-shadow': ['cell filled tile-number', '4'],
        'merge-number-compositor': ['cell filled tile-number', '4'],
        'merge-wild': ['cell filled tile-wild', '<span class="wild-icon">✦<small>2×</small></span>'],
        'merge-wild-no-filter': ['cell filled tile-wild', '<span class="wild-icon">✦<small>2×</small></span>'],
        'merge-wild-no-shadow': ['cell filled tile-wild', '<span class="wild-icon">✦<small>2×</small></span>'],
        'merge-wild-compositor': ['cell filled tile-wild', '<span class="wild-icon">✦<small>2×</small></span>'],
        'zero-bust': ['cell filled tile-zero', '0'],
        'zero-bust-no-shadow': ['cell filled tile-zero', '0'],
        'zero-bust-compositor': ['cell filled tile-zero', '0'],
        spawn: ['cell filled tile-number', '2'],
        'spawn-no-shadow': ['cell filled tile-number', '2'],
        'wild-shadow': ['cell filled tile-wild', '<span class="wild-icon">✦<small>2×</small></span>'],
        'lock-shadow': ['cell filled tile-lock', '<span class="lock-icon">⛓<small>Lock</small></span>']
      };
      const effects = {
        'merge-number': 'fx-merge-number',
        'merge-number-no-shadow': 'fx-merge-number',
        'merge-number-compositor': 'fx-merge-number',
        'merge-wild': 'fx-merge-wild',
        'merge-wild-no-filter': 'fx-merge-wild',
        'merge-wild-no-shadow': 'fx-merge-wild',
        'merge-wild-compositor': 'fx-merge-wild',
        'zero-bust': 'fx-zero-bust',
        'zero-bust-no-shadow': 'fx-zero-bust',
        'zero-bust-compositor': 'fx-zero-bust',
        spawn: 'fx-spawn',
        'spawn-no-shadow': 'fx-spawn'
      };
      try {
        cell.className = variants[${JSON.stringify(caseName)}][0];
        cell.innerHTML = variants[${JSON.stringify(caseName)}][1];
        cell.removeAttribute('style');
        if (${JSON.stringify(caseName)}.endsWith('-no-shadow')) cell.style.setProperty('box-shadow', 'none', 'important');
        if (${JSON.stringify(caseName)} === 'merge-wild-no-filter') cell.style.setProperty('filter', 'none', 'important');
        if (${JSON.stringify(caseName)}.endsWith('-compositor')) {
          cell.style.setProperty('box-shadow', 'none', 'important');
          cell.style.setProperty('will-change', 'transform, opacity', 'important');
        }
        if (${JSON.stringify(caseName)} === 'merge-wild-compositor') cell.style.setProperty('filter', 'none', 'important');
        if (${JSON.stringify(caseName)} === 'zero-bust-compositor') cell.style.setProperty('border-color', 'currentColor', 'important');
        cell.setAttribute('aria-label', 'temporary profiling cell');
        await frames(3);
        performance.clearMarks(${JSON.stringify(startName)});
        performance.clearMarks(${JSON.stringify(endName)});
        performance.mark(${JSON.stringify(startName)});
        for (let index = 0; index < ${repeats}; index += 1) {
          cell.getAnimations().forEach(animation => animation.cancel());
          const effect = effects[${JSON.stringify(caseName)}];
          if (effect) {
            cell.classList.remove(effect);
            void cell.offsetWidth;
            cell.classList.add(effect);
          } else {
            if (${JSON.stringify(caseName)} === 'wild-shadow' || ${JSON.stringify(caseName)} === 'lock-shadow') {
              cell.className = 'cell filled tile-number';
              cell.textContent = '4';
              void cell.offsetWidth;
              cell.className = variants[${JSON.stringify(caseName)}][0];
              cell.innerHTML = variants[${JSON.stringify(caseName)}][1];
            }
            cell.animate(
              [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.06)', opacity: .82 }, { transform: 'scale(1)', opacity: 1 }],
              { duration: 420, easing: 'ease-out' }
            );
          }
          await wait(480);
        }
        await frames(3);
        performance.mark(${JSON.stringify(endName)});
        return { activations: ${repeats} };
      } finally {
        cell.getAnimations().forEach(animation => animation.cancel());
        cell.className = saved.className;
        cell.innerHTML = saved.html;
        if (saved.style === null) cell.removeAttribute('style'); else cell.setAttribute('style', saved.style);
        if (saved.label === null) cell.removeAttribute('aria-label'); else cell.setAttribute('aria-label', saved.label);
      }
    })()`,
    returnByValue: true,
    awaitPromise: true
  }, sessionId, repeats * 600 + 15_000);
  if (run.exceptionDetails) throw new Error(run.exceptionDetails.exception?.description ?? `Profile case ${caseName} failed`);
  await command("Tracing.end");
  await completed;
  activeTrace.tracing = false;
  if (activeTrace.overflow) throw new Error(`Trace for ${caseName} exceeded the ${activeTrace.limit}-event memory limit`);
  results[caseName] = summarize(events, startName, endName);
  activeTrace = null;
}

output = {
  schemaVersion: 1,
  context: {
    target: "Binary 2048 production root",
    orientation: "portrait",
    reducedMotion: false,
    repetitionsPerCase: repeats,
    metricLimit: "Chrome trace pipeline timing; not physical display presentation"
  },
  cases: results
};
}
} finally {
  if (activeTrace?.tracing) {
    try {
      await command("Tracing.end");
      await activeTrace.completed;
    } catch {
      // Preserve the original profiling/refusal error while still closing CDP.
    }
  }
  try {
    await command("Target.detachFromTarget", { sessionId });
  } finally {
    socket.close();
  }
}

console.log(JSON.stringify(output, null, 2));
