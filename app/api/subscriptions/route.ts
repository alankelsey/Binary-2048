import { NextResponse } from "next/server";
import { listSubscriptions, removeSubscription, upsertSubscription } from "@/lib/binary2048/subscriptions";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const subscriberId = url.searchParams.get("subscriberId");
  if (!subscriberId) {
    return NextResponse.json({ error: "subscriberId query param is required" }, { status: 400 });
  }
  return NextResponse.json({
    subscriberId,
    subscriptions: listSubscriptions(subscriberId)
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const subscription = upsertSubscription({
      subscriberId: body?.subscriberId,
      transport: body?.transport,
      endpoint: body?.endpoint,
      topics: body?.topics,
      enabled: body?.enabled
    });
    return NextResponse.json({ subscription }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid subscription payload" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id query param is required" }, { status: 400 });
  const deleted = removeSubscription(id);
  return NextResponse.json({ id, deleted }, { status: deleted ? 200 : 404 });
}
