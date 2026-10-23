import assert from "node:assert/strict";
import test from "node:test";
import { resolveWorkerJob } from "./worker-job-client.mjs";

const jobId = "a".repeat(64);
const accepted = {
  jobId,
  status: "queued",
  statusUrl: `/api/jobs/${jobId}`,
  resultUrl: `/api/jobs/${jobId}/result`
};

test("polls status then reads the dedicated same-origin result", async t => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    assert.equal(new Headers(init.headers).get("x-binary2048-job-contract"), "2");
    if (calls.length === 1) return new Response(JSON.stringify({ status: "complete", resultUrl: accepted.resultUrl }));
    return new Response(JSON.stringify({ status: "complete", result: { ok: true } }));
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  assert.deepEqual(
    await resolveWorkerJob("https://example.test/api/bots/tournament", accepted, { "x-api-key": "secret" }, { pollIntervalMs: 0, deadlineMs: 1000 }),
    { ok: true }
  );
  assert.deepEqual(calls, [
    `https://example.test/api/jobs/${jobId}`,
    `https://example.test/api/jobs/${jobId}/result`
  ]);
});

test("keeps the legacy inline-result compatibility path", async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ status: "complete", result: { legacy: true } }));
  t.after(() => { globalThis.fetch = originalFetch; });

  assert.deepEqual(
    await resolveWorkerJob("https://example.test", accepted, {}, { pollIntervalMs: 0, deadlineMs: 1000 }),
    { legacy: true }
  );
});

test("rejects a cross-origin result URL", async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ status: "complete", resultUrl: "https://evil.test/result" }));
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(
    resolveWorkerJob("https://example.test", accepted, {}, { pollIntervalMs: 0, deadlineMs: 1000 }),
    /submission origin/
  );
});
