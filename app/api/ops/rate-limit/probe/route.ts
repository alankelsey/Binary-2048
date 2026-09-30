import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/binary2048/admin-auth";
import { checkRateLimit } from "@/lib/binary2048/rate-limit";

const PROBE_ID_PATTERN = /^[a-f0-9]{32}$/;
const PROBE_LIMIT = 10_000;
const PROBE_WINDOW_MS = 60_000;

const globalProbe = globalThis as typeof globalThis & {
  __binary2048_rate_limit_probe_runtime_id?: string;
};

function runtimeId() {
  if (!globalProbe.__binary2048_rate_limit_probe_runtime_id) {
    globalProbe.__binary2048_rate_limit_probe_runtime_id = randomBytes(16).toString("hex");
  }
  return globalProbe.__binary2048_rate_limit_probe_runtime_id;
}

function holdMs() {
  const configured = Number(process.env.BINARY2048_RATE_LIMIT_PROBE_HOLD_MS ?? "500");
  return Number.isFinite(configured) ? Math.max(0, Math.min(2_000, Math.floor(configured))) : 500;
}

export async function POST(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin authorization required" }, { status: 401 });
  }

  const probeId = new URL(req.url).searchParams.get("probeId") ?? "";
  if (!PROBE_ID_PATTERN.test(probeId)) {
    return NextResponse.json({ error: "Valid probeId is required" }, { status: 400 });
  }

  const quota = await checkRateLimit({
    req,
    route: `ops_rate_limit_probe_${probeId}`,
    max: PROBE_LIMIT,
    windowMs: PROBE_WINDOW_MS,
    sharedForApiKeysOnly: true
  });
  if (quota.scope !== "api-key") {
    return NextResponse.json({ error: "Valid bot API key required" }, { status: 401 });
  }
  if (quota.backend !== "mongo") {
    return NextResponse.json({ error: "Shared rate-limit store unavailable", backend: quota.backend }, { status: 503 });
  }

  await new Promise((resolve) => setTimeout(resolve, holdMs()));
  return NextResponse.json(
    {
      ok: true,
      backend: quota.backend,
      scope: quota.scope,
      limit: quota.limit,
      remaining: quota.remaining,
      resetAtEpochSeconds: quota.resetAtEpochSeconds,
      runtimeId: runtimeId()
    },
    { headers: { "cache-control": "no-store" } }
  );
}
