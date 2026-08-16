import { NextResponse } from "next/server";
import { evaluateChallenge } from "@/lib/binary2048/challenge-policy";
import { checkSimulateRateLimit, rateLimitHeaders, type RateLimitResult } from "@/lib/binary2048/rate-limit";
import { EndpointCostCapError } from "@/lib/binary2048/cost-caps";
import { getDegradeState } from "@/lib/binary2048/degrade-mode";
import { parseJsonWithLimit, RequestBodyTooLargeError } from "@/lib/binary2048/request-body-limit";
import { simulateBatch, type SimulateBatchRequest } from "@/lib/binary2048/simulate";

const MAX_SIMULATE_BODY_BYTES = 128 * 1024;

export async function POST(req: Request) {
  let quota: RateLimitResult | null = null;
  try {
    const degrade = getDegradeState("simulate");
    if (degrade.disabled) {
      return NextResponse.json(
        { error: "Endpoint temporarily disabled", code: "degrade_mode", route: "simulate", reason: degrade.reason },
        { status: 503, headers: { "retry-after": "60" } }
      );
    }
    const challenge = evaluateChallenge({ req, route: "/api/simulate", risk: "high", userTier: "guest" });
    if (!challenge.allowed) {
      return NextResponse.json(
        {
          error: "Challenge required",
          route: "/api/simulate",
          reason: challenge.reason,
          mode: challenge.mode
        },
        { status: 403 }
      );
    }
    quota = await checkSimulateRateLimit(req);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          route: "simulate",
          limit: quota.limit,
          remaining: quota.remaining,
          retryAfterSeconds: quota.retryAfterSeconds
        },
        { status: 429, headers: rateLimitHeaders(quota) }
      );
    }
    const body = await parseJsonWithLimit<SimulateBatchRequest>(req, MAX_SIMULATE_BODY_BYTES);
    const result = simulateBatch(body);
    return NextResponse.json(result, { headers: rateLimitHeaders(quota) });
  } catch (error) {
    const headers = quota ? rateLimitHeaders(quota) : undefined;
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413, headers });
    }
    if (error instanceof EndpointCostCapError) {
      return NextResponse.json(
        { error: error.message, code: error.code, field: error.field, limit: error.limit, value: error.value },
        { status: 400, headers }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid simulation request" },
      { status: 400, headers }
    );
  }
}
