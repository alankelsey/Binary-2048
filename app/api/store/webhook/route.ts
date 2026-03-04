import { NextResponse } from "next/server";
import { processStoreWebhookEvent } from "@/lib/binary2048/store-webhook";

function hasValidWebhookSecret(req: Request): boolean {
  const expected = process.env.BINARY2048_STORE_WEBHOOK_SECRET;
  if (!expected) return true;
  const provided = req.headers.get("x-store-webhook-secret") ?? "";
  return provided.length > 0 && provided === expected;
}

export async function POST(req: Request) {
  try {
    if (!hasValidWebhookSecret(req)) {
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const processed = processStoreWebhookEvent(body);
    return NextResponse.json(processed, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid webhook event" },
      { status: 400 }
    );
  }
}

