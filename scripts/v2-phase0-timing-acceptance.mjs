import { randomUUID } from "node:crypto";

const base = (process.env.PROD_BASE ?? "https://www.binary2048.com").replace(/\/$/, "");
const sampleCount = Math.max(1, Math.min(20, Number(process.env.TIMING_SAMPLE_COUNT ?? "6")));
const allowedTimingNames = new Set([
  "rate_limit_identity",
  "rate_limit_counter",
  "request_parse",
  "session_lookup",
  "recovery_verify",
  "recovery_replay",
  "recovery_import",
  "engine_move",
  "session_persist",
  "snapshot_build",
  "snapshot_sign",
  "response_encode",
  "total"
]);

function parseServerTiming(value) {
  if (!value) throw new Error("Server-Timing header is missing");
  return value.split(",").map((part) => {
    const match = part.trim().match(/^([a-z_]+);dur=(\d+(?:\.\d+)?)$/);
    if (!match || !allowedTimingNames.has(match[1])) {
      throw new Error("Server-Timing contains an invalid metric");
    }
    const durationMs = Number(match[2]);
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new Error("Server-Timing contains an invalid duration");
    }
    return { name: match[1], durationMs };
  });
}

async function request(path, init, expectedStatus) {
  const response = await fetch(`${base}${path}`, init);
  const body = await response.json().catch(() => null);
  if (response.status !== expectedStatus) {
    throw new Error(`Unexpected ${response.status} response for acceptance step`);
  }
  return { response, body };
}

function sanitizedSample(label, response) {
  return {
    label,
    status: response.status,
    cacheControl: response.headers.get("cache-control"),
    timings: parseServerTiming(response.headers.get("server-timing"))
  };
}

const startedAt = new Date().toISOString();
const create = await request("/api/games", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}"
}, 200);

if (typeof create.body?.id !== "string" || !create.body?.recoverySnapshot) {
  throw new Error("Create response is missing the acceptance session data");
}

let gameId = create.body.id;
let recoverySnapshot = create.body.recoverySnapshot;
const samples = [];

for (let index = 0; index < sampleCount; index += 1) {
  const move = await request(`/api/games/${encodeURIComponent(gameId)}/move`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dir: index % 2 === 0 ? "left" : "down", recoverySnapshot })
  }, 200);
  samples.push(sanitizedSample(index === 0 ? "first_move" : "warm_move", move.response));
  gameId = move.body.id;
  recoverySnapshot = move.body.recoverySnapshot;
}

const missing = await request(`/api/games/${randomUUID()}/move`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ dir: "left" })
}, 404);
samples.push(sanitizedSample("missing_session", missing.response));

const unsignedRecoverySnapshot = structuredClone(recoverySnapshot);
delete unsignedRecoverySnapshot.signature;
const recovery = await request(`/api/games/${randomUUID()}/move`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ dir: "right", recoverySnapshot: unsignedRecoverySnapshot })
}, 200);
samples.push(sanitizedSample("recovery_import", recovery.response));

for (const sample of samples) {
  if (sample.cacheControl !== "no-store") throw new Error("Move response is missing Cache-Control: no-store");
}

console.log(JSON.stringify({
  target: new URL(base).host,
  startedAt,
  completedAt: new Date().toISOString(),
  sampleCount: samples.length,
  samples
}, null, 2));
