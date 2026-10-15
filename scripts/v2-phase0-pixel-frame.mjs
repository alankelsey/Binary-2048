#!/usr/bin/env node

import http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const WebSocket = require("next/dist/compiled/ws");
const endpoint = process.env.BINARY2048_CDP_ENDPOINT ?? "http://127.0.0.1:9222";

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
const traceEvents = [];
const maxTraceEvents = 100_000;
let traceOverflow = false;
let tracingComplete;
const tracingFinished = new Promise(resolve => { tracingComplete = resolve; });

socket.on("message", data => {
  const message = JSON.parse(data.toString());
  if (message.method === "Tracing.dataCollected" && Array.isArray(message.params?.value)) {
    const remaining = maxTraceEvents - traceEvents.length;
    if (message.params.value.length > remaining) traceOverflow = true;
    traceEvents.push(...message.params.value.slice(0, Math.max(0, remaining)));
    return;
  }
  if (message.method === "Tracing.tracingComplete") {
    tracingComplete();
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

function command(method, params = {}, sessionId, timeoutMs = 10_000) {
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
const matches = targetInfos.filter(target =>
  target.type === "page" &&
  target.title === "Binary 2048" &&
  target.url === "https://www.binary2048.com/"
);
if (matches.length !== 1) throw new Error(`Expected exactly one Binary 2048 production tab; found ${matches.length}`);

const { sessionId } = await command("Target.attachToTarget", {
  targetId: matches[0].targetId,
  flatten: true
});
await command("Runtime.evaluate", {
  expression: `(() => {
    performance.clearMarks('binary2048:move-complete');
    performance.clearMarks('binary2048:move-dropped');
    performance.clearMeasures('binary2048:move-input-to-next-frame');
    performance.clearResourceTimings();
  })()`
}, sessionId);
await command("Tracing.start", {
  categories: "blink.user_timing,devtools.timeline,disabled-by-default-devtools.timeline.frame",
  options: "record-as-much-as-possible",
  transferMode: "ReportEvents"
});

console.log("READY: perform one long single-finger swipe inside the board");

const deadline = Date.now() + 60_000;
let completed = 0;
while (Date.now() < deadline) {
  const evaluation = await command("Runtime.evaluate", {
    expression: "performance.getEntriesByName('binary2048:move-complete').length",
    returnByValue: true
  }, sessionId);
  completed = evaluation.result?.value ?? 0;
  if (completed > 0) break;
  await new Promise(resolve => setTimeout(resolve, 250));
}
if (completed !== 1) {
  await command("Tracing.end");
  await tracingFinished;
  throw new Error(`Expected one completed swipe before timeout; observed ${completed}`);
}

await new Promise(resolve => setTimeout(resolve, 1000));
await command("Tracing.end");
await tracingFinished;
await command("Target.detachFromTarget", { sessionId });
socket.close();
if (traceOverflow) throw new Error(`Frame trace exceeded the ${maxTraceEvents}-event memory limit`);

const markEvents = traceEvents
  .filter(event => typeof event.name === "string" && event.name.startsWith("binary2048:move:"))
  .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
const reactCommit = markEvents.find(event => event.name.includes(":react_commit"));
const nextFrame = markEvents.find(event => event.name.includes(":next_animation_frame"));
const frameKinds = ["BeginFrame", "DrawFrame", "Paint", "CompositeLayers"];
const followingKinds = [...new Set(traceEvents
  .filter(event => reactCommit && Number.isFinite(event.ts) && event.ts >= reactCommit.ts && frameKinds.includes(event.name))
  .map(event => event.name))].sort();

console.log(JSON.stringify({
  completedMoves: completed,
  reactCommitMarkObserved: Boolean(reactCommit),
  nextFrameMarkObserved: Boolean(nextFrame),
  frameOrPaintAfterCommit: followingKinds.length > 0,
  observedKinds: followingKinds
}, null, 2));
