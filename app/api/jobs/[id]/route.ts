import { NextResponse } from "next/server";
import { workerCollections, workerJobsEnabled } from "@/lib/binary2048/worker-jobs";
import { checkJobStatusRateLimit, rateLimitHeaders } from "@/lib/binary2048/rate-limit";
import { authorizeResearchRequest } from "@/lib/binary2048/research-auth";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const headers = { "cache-control": "no-store" };
  if (!workerJobsEnabled() || !/^[a-f0-9]{64}$/.test(id)) return NextResponse.json({ error: "Job not found" }, { status: 404, headers });
  const authorization = authorizeResearchRequest(req, "jobs:read");
  if (!authorization.allowed) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers });
  const quota = await checkJobStatusRateLimit(req);
  if (!quota.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { ...headers, ...rateLimitHeaders(quota) } });
  try {
    const { jobs } = await workerCollections();
    const job = await jobs.findOne({ _id: id, expiresAt: { $gt: new Date() } }, { projection: { task: 0 } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404, headers });
    // Ownerless records are pre-scope compatibility jobs and already expire within 24 hours.
    if (job.owner && job.owner !== authorization.authority.principal && !authorization.authority.admin) {
      return NextResponse.json({ error: "Job not found" }, { status: 404, headers });
    }
    const exhausted = job.status === "running" && job.attempts >= 2 && job.leaseUntil && job.leaseUntil.getTime() < Date.now();
    return NextResponse.json({ jobId: id, status: exhausted ? "failed" : job.status, result: job.result, error: exhausted ? "Worker execution limit reached" : job.error, createdAt: job.createdAt, expiresAt: job.expiresAt }, { headers: { ...headers, "retry-after": "2" } });
  } catch { return NextResponse.json({ error: "Worker status unavailable" }, { status: 503, headers }); }
}
