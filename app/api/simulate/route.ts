import { NextResponse } from "next/server";
import { checkSimulateRateLimit } from "@/lib/binary2048/rate-limit";
import { simulateBatch, type SimulateBatchRequest } from "@/lib/binary2048/simulate";

export async function POST(req: Request) {
  try {
    const quota = checkSimulateRateLimit(req);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          route: "simulate",
          limit: quota.limit,
          remaining: quota.remaining,
          retryAfterSeconds: quota.retryAfterSeconds
        },
        { status: 429, headers: { "retry-after": String(quota.retryAfterSeconds) } }
      );
    }
    const body = (await req.json()) as SimulateBatchRequest;
    const result = simulateBatch(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid simulation request" },
      { status: 400 }
    );
  }
}
