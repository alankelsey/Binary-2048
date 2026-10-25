import { NextResponse } from "next/server";
import { loadWorkerArtifact, workerCollections, workerJobsEnabled } from "@/lib/binary2048/worker-jobs";
import { checkJobStatusRateLimit, rateLimitHeaders } from "@/lib/binary2048/rate-limit";
import { authorizeResearchRequest } from "@/lib/binary2048/research-auth";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const headers = { "cache-control": "no-store" };
  if (!workerJobsEnabled() || !/^[a-f0-9]{64}$/.test(id)) {
    return NextResponse.json({ error: "Job not found" }, { status: 404, headers });
  }
  const authorization = authorizeResearchRequest(req, "jobs:read");
  if (!authorization.allowed) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers });
  }
  const quota = await checkJobStatusRateLimit(req);
  if (!quota.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { ...headers, ...rateLimitHeaders(quota) } });
  }
  try {
    const { jobs, artifacts } = await workerCollections();
    const job = await jobs.findOne({ _id: id, expiresAt: { $gt: new Date() } }, { projection: { task: 0 } });
    if (!job || (job.owner && job.owner !== authorization.authority.principal && !authorization.authority.admin)) {
      return NextResponse.json({ error: "Job not found" }, { status: 404, headers });
    }
    const exhausted = job.status === "running" && job.attempts >= 2 && job.leaseUntil && job.leaseUntil.getTime() < Date.now();
    if (exhausted || job.status === "failed") {
      return NextResponse.json(
        { jobId: id, status: "failed", error: exhausted ? "Worker execution limit reached" : job.error },
        { status: 409, headers }
      );
    }
    if (job.status !== "complete") {
      return NextResponse.json(
        { jobId: id, status: job.status, resultUrl: `/api/jobs/${id}/result` },
        { status: 202, headers: { ...headers, "retry-after": "2" } }
      );
    }
    const result = await loadWorkerArtifact(artifacts, job);
    return NextResponse.json({ jobId: id, status: "complete", result }, { headers });
  } catch {
    return NextResponse.json({ error: "Worker result unavailable" }, { status: 503, headers });
  }
}
