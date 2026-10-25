import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseURL = process.env.V2_BROWSER_BASE ?? "https://www.binary2048.com";
const mode = process.env.V2_BROWSER_MODE ?? "guest";
const storageState = process.env.AUTH_STORAGE_STATE ?? "artifacts/auth-acceptance/storage-state.json";
const output = process.env.V2_BROWSER_OUTPUT;
const headless = process.env.V2_BROWSER_HEADLESS === "1";
const expectedCommit = process.env.V2_BROWSER_EXPECT_COMMIT;
const validModes = new Set(["guest", "authenticated"]);
if (!validModes.has(mode)) throw new Error("V2_BROWSER_MODE must be guest or authenticated");

const serverTimingNames = new Set([
  "rate_limit_identity", "rate_limit_counter", "request_parse", "session_lookup",
  "recovery_verify", "recovery_replay", "recovery_import", "engine_move",
  "session_persist", "snapshot_build", "snapshot_sign", "response_encode", "total"
]);
const requiredServerTimingNames = [
  "rate_limit_identity", "rate_limit_counter", "request_parse", "session_lookup",
  "engine_move", "session_persist", "response_encode", "total"
];

const round = (value) => Number(Math.max(0, Number(value) || 0).toFixed(2));

function parseServerTiming(value) {
  if (!value) throw new Error("Server-Timing header is missing");
  const parsed = new Map();
  for (const part of value.split(",")) {
    const match = part.trim().match(/^([a-z0-9_]+);dur=((?:0|[1-9][0-9]*)(?:\.[0-9]+)?)$/);
    if (!match) throw new Error("Unexpected Server-Timing metric");
    const [, name, rawDuration] = match;
    if (!serverTimingNames.has(name)) throw new Error(`Unknown Server-Timing metric: ${name}`);
    if (parsed.has(name)) throw new Error(`Duplicate Server-Timing metric: ${name}`);
    const duration = Number(rawDuration);
    if (!Number.isFinite(duration) || duration < 0) throw new Error(`Invalid Server-Timing duration: ${name}`);
    parsed.set(name, round(duration));
  }
  for (const name of requiredServerTimingNames) {
    if (!parsed.has(name)) throw new Error(`Required Server-Timing metric is missing: ${name}`);
  }
  return Object.fromEntries(parsed);
}

function parseResourceServerTiming(metrics) {
  if (!Array.isArray(metrics) || metrics.length === 0) throw new Error("Resource Server-Timing is missing");
  const parsed = new Map();
  for (const metric of metrics) {
    if (!serverTimingNames.has(metric?.name)) throw new Error(`Unknown resource Server-Timing metric: ${metric?.name}`);
    if (parsed.has(metric.name)) throw new Error(`Duplicate resource Server-Timing metric: ${metric.name}`);
    if (!Number.isFinite(metric.duration) || metric.duration < 0) throw new Error(`Invalid resource Server-Timing duration: ${metric.name}`);
    parsed.set(metric.name, round(metric.duration));
  }
  for (const name of requiredServerTimingNames) {
    if (!parsed.has(name)) throw new Error(`Required resource Server-Timing metric is missing: ${name}`);
  }
  return Object.fromEntries(parsed);
}

function percentile(values, percent) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * percent / 100) - 1)];
}

function summarizeSamples(samples, field = "inputToNextFrameMs") {
  const timings = samples.map((sample) => sample[field]);
  return {
    count: samples.length,
    medianMs: percentile(timings, 50),
    p95Ms: percentile(timings, 95),
    maxMs: timings.length ? Math.max(...timings) : null
  };
}

async function readTraceProjection(page) {
  return page.evaluate(() => {
    const delta = (phases, from, to) => {
      const start = phases.find((item) => item.phase === from)?.atMs;
      const end = phases.find((item) => item.phase === to)?.atMs;
      return typeof start === "number" && typeof end === "number"
        ? Math.max(0, Number((end - start).toFixed(2)))
        : null;
    };
    const completed = performance.getEntriesByName("binary2048:move-input-to-next-frame").map((entry) => {
      const detail = entry.detail ?? {};
      const phases = Array.isArray(detail.phases) ? detail.phases : [];
      const depths = Array.isArray(detail.queueDepthSamples) ? detail.queueDepthSamples : [];
      const storage = Array.isArray(detail.localStorageSamples) ? detail.localStorageSamples : [];
      const checkpoints = Array.isArray(detail.checkpointSamples) ? detail.checkpointSamples : [];
      return {
        source: ["keyboard", "touch", "control"].includes(detail.source) ? detail.source : "unknown",
        disposition: phases.some((item) => item.phase === "queued") ? "queued" : "accepted",
        localEngineStatus: detail.localEngineStatus === "completed" ? "completed" : "unknown",
        inputToNextFrameMs: Math.max(0, Number(entry.duration.toFixed(2))),
        inputToLocalPredictionPaintMs: delta(phases, "input_capture", "local_prediction_paint"),
        captureToRequestMs: delta(phases, "input_capture", "request_start"),
        requestToHeadersMs: delta(phases, "request_start", "response_headers"),
        headersToParseEndMs: delta(phases, "response_headers", "response_parse_end"),
        parseEndToCommitMs: delta(phases, "response_parse_end", "react_commit"),
        commitToNextFrameMs: delta(phases, "react_commit", "next_animation_frame"),
        queueDepths: depths.map((item) => ({
          stage: ["capture", "enqueue", "dequeue", "drop"].includes(item.stage) ? item.stage : "unknown",
          depth: Math.max(0, Number(item.depth) || 0)
        })),
        localStorageReadMs: Math.max(0, Number(storage
          .filter((item) => item.operation === "read")
          .reduce((sum, item) => sum + Number(item.durationMs || 0), 0).toFixed(2))),
        localStorageWriteMs: Math.max(0, Number(storage
          .filter((item) => item.operation === "write")
          .reduce((sum, item) => sum + Number(item.durationMs || 0), 0).toFixed(2))),
        checkpointMs: Math.max(0, Number(checkpoints
          .reduce((sum, item) => sum + Number(item.durationMs || 0), 0).toFixed(2)))
      };
    });
    const dropped = performance.getEntriesByName("binary2048:move-dropped").map((entry) => {
      const detail = entry.detail ?? {};
      const depths = Array.isArray(detail.queueDepthSamples) ? detail.queueDepthSamples : [];
      return {
        source: ["keyboard", "touch", "control"].includes(detail.source) ? detail.source : "unknown",
        disposition: "dropped",
        reason: typeof detail.dropReason === "string" ? detail.dropReason : "unknown",
        queueDepths: depths.map((item) => ({
          stage: ["capture", "enqueue", "dequeue", "drop"].includes(item.stage) ? item.stage : "unknown",
          depth: Math.max(0, Number(item.depth) || 0)
        }))
      };
    });
    return { completed, dropped };
  });
}

async function clearEntries(page) {
  await page.evaluate(() => {
    performance.clearMarks();
    performance.clearMeasures();
    performance.clearResourceTimings();
  });
}

async function readResourceServerTimings(page) {
  return page.evaluate(() => performance.getEntriesByType("resource")
    .filter((entry) => {
      const url = new URL(entry.name);
      return url.origin === location.origin && /\/api\/games\/[^/]+\/move$/.test(url.pathname);
    })
    .map((entry) => entry.serverTiming.map((metric) => ({ name: metric.name, duration: metric.duration }))));
}

async function waitForCount(page, count) {
  await page.waitForFunction((expected) => {
    const completed = performance.getEntriesByName("binary2048:move-complete").length;
    const dropped = performance.getEntriesByName("binary2048:move-dropped").length;
    return completed + dropped >= expected;
  }, count, { timeout: 60_000 });
}

function validateCompletedTrace(sample) {
  if (sample.source !== "keyboard" || sample.localEngineStatus !== "completed") {
    throw new Error("Completed trace source or local-engine status is invalid");
  }
  for (const name of [
    "inputToNextFrameMs", "inputToLocalPredictionPaintMs", "captureToRequestMs", "requestToHeadersMs",
    "headersToParseEndMs", "parseEndToCommitMs", "commitToNextFrameMs"
  ]) {
    if (!Number.isFinite(sample[name]) || sample[name] < 0) {
      throw new Error(`Completed trace has invalid ${name}`);
    }
  }
  if (sample.queueDepths.some((item) => !Number.isInteger(item.depth) || item.depth < 0 || item.stage === "unknown")) {
    throw new Error("Completed trace has an invalid queue-depth sample");
  }
  const stages = sample.queueDepths.map((item) => item.stage);
  if (!stages.includes("capture")) throw new Error("Completed trace is missing capture depth");
  if (sample.disposition === "queued" && (!stages.includes("enqueue") || !stages.includes("dequeue"))) {
    throw new Error("Queued trace is missing enqueue or dequeue depth");
  }
  if (sample.disposition !== "accepted" && sample.disposition !== "queued") {
    throw new Error("Completed trace disposition is invalid");
  }
}

function validateDroppedTrace(sample) {
  if (sample.source !== "keyboard" || !sample.reason || sample.reason === "unknown") {
    throw new Error("Dropped trace source or reason is invalid");
  }
  const stages = sample.queueDepths.map((item) => item.stage);
  if (!stages.includes("capture") || !stages.includes("drop")) {
    throw new Error("Dropped trace is missing capture or drop depth");
  }
  if (sample.queueDepths.some((item) => !Number.isInteger(item.depth) || item.depth < 0 || item.stage === "unknown")) {
    throw new Error("Dropped trace has an invalid queue-depth sample");
  }
}

const browser = await chromium.launch({ channel: "chrome", headless });
try {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    ...(mode === "authenticated" ? { storageState } : {})
  });
  await context.addCookies([{ name: "binary2048_tutorial_suppress", value: "1", url: baseURL }]);
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.removeItem("binary2048.currentGameId");
    localStorage.removeItem("binary2048.resumeSnapshot");
    localStorage.setItem("binary2048.tutorial.v1", '{"version":1,"status":"dismissed"}');
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator(".auth-shell").waitFor();
  const authenticated = await page.locator(".auth-shell").getAttribute("data-authenticated") === "true";
  if (authenticated !== (mode === "authenticated")) {
    throw new Error(`Expected ${mode} context but page authenticated=${authenticated}`);
  }
  const versionText = await page.getByLabel("app version").innerText();
  const commitMatch = versionText.match(/\(([a-f0-9]{7,40}|dev)\)/);
  if (!commitMatch) throw new Error("Deployed commit was not found in the public app version");
  const deployedCommit = commitMatch[1];
  if (expectedCommit && deployedCommit !== expectedCommit && !expectedCommit.startsWith(deployedCommit) && !deployedCommit.startsWith(expectedCommit)) {
    throw new Error(`Expected deployed commit ${expectedCommit}, received ${deployedCommit}`);
  }

  await clearEntries(page);
  await page.keyboard.press("ArrowLeft");
  await waitForCount(page, 1);
  const rejectedBeforeGame = await readTraceProjection(page);
  if (rejectedBeforeGame.completed.length !== 0 || rejectedBeforeGame.dropped.length !== 1) {
    throw new Error("Pre-game rejected-input classification was not recorded exactly once");
  }
  validateDroppedTrace(rejectedBeforeGame.dropped[0]);

  await page.getByRole("button", { name: "Start New Game" }).click();
  await page.locator(".card").waitFor();
  await page.waitForFunction(() => document.querySelector(".card")?.getAttribute("aria-busy") === "false");

  const responseTimings = [];
  page.on("response", (response) => {
    const request = response.request();
    if (request.method() !== "POST" || !/\/api\/games\/[^/]+\/move$/.test(new URL(response.url()).pathname)) return;
    responseTimings.push({ status: response.status(), header: response.headers()["server-timing"] });
  });

  await clearEntries(page);
  responseTimings.length = 0;
  const warmupKeys = Array.from({ length: 3 }, () => ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp"]).flat();
  for (let index = 0; index < warmupKeys.length; index += 1) {
    await page.keyboard.press(warmupKeys[index]);
    await waitForCount(page, index + 1);
    await page.waitForFunction(() => document.querySelector(".card")?.getAttribute("aria-busy") === "false");
  }

  await clearEntries(page);
  responseTimings.length = 0;
  const deliberateKeys = Array.from({ length: 5 }, () => ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp"]).flat();
  for (let index = 0; index < deliberateKeys.length; index += 1) {
    await page.keyboard.press(deliberateKeys[index]);
    await waitForCount(page, index + 1);
    await page.waitForFunction(() => document.querySelector(".card")?.getAttribute("aria-busy") === "false");
  }
  await page.waitForFunction(() => document.querySelector(".card")?.getAttribute("aria-busy") === "false");
  const deliberate = await readTraceProjection(page);
  if (deliberate.completed.length !== deliberateKeys.length || deliberate.dropped.length !== 0) {
    throw new Error("Deliberate run did not produce exactly 20 completed traces");
  }
  deliberate.completed.forEach(validateCompletedTrace);
  if (deliberate.completed.some((sample) => sample.disposition !== "accepted")) {
    throw new Error("Deliberate run queued an input instead of pacing one move at a time");
  }
  if (responseTimings.length !== deliberate.completed.length || responseTimings.some((item) => item.status !== 200)) {
    throw new Error("Deliberate client/server sample counts or HTTP statuses did not match");
  }
  const deliberateServerTimings = responseTimings.map((item) => parseServerTiming(item.header));
  const deliberateResourceTimings = (await readResourceServerTimings(page)).map(parseResourceServerTiming);
  if (deliberateResourceTimings.length !== deliberate.completed.length) {
    throw new Error("Deliberate resource/client sample counts did not match");
  }
  const deliberateSamples = deliberate.completed.map((sample, index) => ({
    ...sample,
    serverTimingMs: deliberateServerTimings[index]
  }));

  await clearEntries(page);
  responseTimings.length = 0;
  const rapidKeys = ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown"];
  for (const key of rapidKeys) await page.keyboard.press(key);
  await waitForCount(page, rapidKeys.length);
  await page.waitForFunction(() => document.querySelector(".card")?.getAttribute("aria-busy") === "false");
  const rapid = await readTraceProjection(page);
  if (rapid.completed.length + rapid.dropped.length !== rapidKeys.length) {
    throw new Error("Rapid run left a directional input unclassified");
  }
  rapid.completed.forEach(validateCompletedTrace);
  rapid.dropped.forEach(validateDroppedTrace);
  if (responseTimings.length !== rapid.completed.length || responseTimings.some((item) => item.status !== 200)) {
    throw new Error("Rapid client/server sample counts or HTTP statuses did not match");
  }
  const rapidServerTimings = responseTimings.map((item) => parseServerTiming(item.header));
  const rapidResourceTimings = (await readResourceServerTimings(page)).map(parseResourceServerTiming);
  if (rapidResourceTimings.length !== rapid.completed.length) {
    throw new Error("Rapid resource/client sample counts did not match");
  }
  const rapidSamples = rapid.completed.map((sample, index) => ({
    ...sample,
    serverTimingMs: rapidServerTimings[index]
  }));
  const droppedByReason = rapid.dropped.reduce((counts, item) => {
    counts[item.reason] = (counts[item.reason] ?? 0) + 1;
    return counts;
  }, {});

  const result = {
    schemaVersion: 1,
    capturedAtISO: new Date().toISOString(),
    targetHost: new URL(baseURL).host,
    deployedCommit,
    browser: `Google Chrome ${browser.version()}`,
    platform: process.platform,
    viewport: { width: 1440, height: 900, devicePixelRatio: await page.evaluate(() => devicePixelRatio) },
    authenticated,
    warmupMoves: warmupKeys.length,
    metricLimit: "input capture through the next animation-frame callback; not presented-pixel proof",
    rejectedBeforeGame: rejectedBeforeGame.dropped[0],
    deliberate: {
      intendedInputs: deliberateKeys.length,
      classifiedInputs: deliberate.completed.length,
      summary: summarizeSamples(deliberateSamples),
      localPredictionSummary: summarizeSamples(deliberateSamples, "inputToLocalPredictionPaintMs"),
      samples: deliberateSamples
    },
    rapid: {
      intendedInputs: rapidKeys.length,
      classifiedInputs: rapid.completed.length + rapid.dropped.length,
      accepted: rapid.completed.filter((item) => item.disposition === "accepted").length,
      queued: rapid.completed.filter((item) => item.disposition === "queued").length,
      dropped: rapid.dropped.length,
      droppedByReason,
      summary: summarizeSamples(rapidSamples),
      completedSamples: rapidSamples,
      droppedSamples: rapid.dropped
    }
  };

  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (output) {
    const outputPath = path.resolve(output);
    const artifactRoot = path.resolve("artifacts");
    if (!outputPath.startsWith(`${artifactRoot}${path.sep}`)) {
      throw new Error("V2_BROWSER_OUTPUT must be inside the ignored artifacts directory");
    }
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serialized, { mode: 0o600 });
    await chmod(outputPath, 0o600);
  }
  process.stdout.write(serialized);
  await context.close();
} finally {
  await browser.close();
}
