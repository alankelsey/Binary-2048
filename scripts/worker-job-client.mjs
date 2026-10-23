/** Resolve either a legacy immediate result or the V1 queued-job response. */
export async function resolveWorkerJob(base, payload, headers = {}, options = {}) {
  if (!payload?.jobId || payload.status !== "queued") return payload;
  const origin = new URL(base).origin;
  if (!/^[a-f0-9]{64}$/.test(payload.jobId)) throw new Error("Invalid worker job identifier");
  const sameOriginUrl = value => {
    const url = new URL(value, origin);
    if (url.origin !== origin) throw new Error("Worker job URL must use the submission origin");
    return url;
  };
  const statusUrl = sameOriginUrl(payload.statusUrl ?? `/api/jobs/${payload.jobId}`);
  const requestHeaders = new Headers(headers);
  requestHeaders.set("x-binary2048-job-contract", "2");
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const deadline = Date.now() + (options.deadlineMs ?? 12 * 60 * 1000);
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    const response = await fetch(statusUrl, { headers: requestHeaders, signal: AbortSignal.timeout(15000) });
    const state = await response.json();
    if (!response.ok) throw new Error(state.error ?? `Job status failed: ${response.status}`);
    if (state.status === "complete") {
      if (!state.resultUrl) return state.result;
      const resultResponse = await fetch(sameOriginUrl(state.resultUrl), { headers: requestHeaders, signal: AbortSignal.timeout(15000) });
      const resultPayload = await resultResponse.json();
      if (!resultResponse.ok) throw new Error(resultPayload.error ?? `Job result failed: ${resultResponse.status}`);
      return resultPayload.result;
    }
    if (state.status === "failed") throw new Error(state.error ?? "Worker execution failed");
  }
  throw new Error("Worker job polling deadline exceeded");
}
