/** Resolve either a legacy immediate result or the V1 queued-job response. */
export async function resolveWorkerJob(base, payload, headers = {}) {
  if (!payload?.jobId || payload.status !== "queued") return payload;
  const origin = new URL(base).origin;
  if (!/^[a-f0-9]{64}$/.test(payload.jobId)) throw new Error("Invalid worker job identifier");
  const deadline = Date.now() + 12 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const response = await fetch(`${origin}/api/jobs/${payload.jobId}`, { headers, signal: AbortSignal.timeout(15000) });
    const state = await response.json();
    if (!response.ok) throw new Error(state.error ?? `Job status failed: ${response.status}`);
    if (state.status === "complete") return state.result;
    if (state.status === "failed") throw new Error(state.error ?? "Worker execution failed");
  }
  throw new Error("Worker job polling deadline exceeded");
}
