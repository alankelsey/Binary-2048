import { NextResponse } from "next/server";
import { workerCollections, workerJobsEnabled } from "@/lib/binary2048/worker-jobs";
import { checkMoveRateLimit, rateLimitHeaders } from "@/lib/binary2048/rate-limit";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const headers = { "cache-control": "no-store" };
  if (!workerJobsEnabled() || !/^[a-f0-9]{64}$/.test(id)) return NextResponse.json({ error: "Job not found" }, { status: 404, headers });
  const quota = await checkMoveRateLimit(req);
  if (!quota.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { ...headers, ...rateLimitHeaders(quota) } });
  try {
    const { jobs } = await workerCollections();
    const job = await jobs.findOne({ _id: id, expiresAt: { $gt: new Date() } }, { projection: { task: 0 } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404, headers });
    const exhausted = job.status === "running" && job.attempts >= 2 && job.leaseUntil && job.leaseUntil.getTime() < Date.now();
    return NextResponse.json({ jobId: id, status: exhausted ? "failed" : job.status, result: job.result, error: exhausted ? "Worker execution limit reached" : job.error, createdAt: job.createdAt, expiresAt: job.expiresAt }, { headers: { ...headers, "retry-after": "2" } });
  } catch { return NextResponse.json({ error: "Worker status unavailable" }, { status: 503, headers }); }
}
