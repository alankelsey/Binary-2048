import { NextResponse } from "next/server";
import { getVerifiedAuthClaims } from "@/lib/binary2048/auth-context";
import { getAllowedTopicsForTier, splitTopicsByAccess } from "@/lib/binary2048/feature-gating";
import { listSubscriptions, normalizeTopics, removeSubscription, upsertSubscription } from "@/lib/binary2048/subscriptions";

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
    const claims = getVerifiedAuthClaims(req);
    const tier = claims?.tier ?? "guest";
    const normalizedRequestedTopics = normalizeTopics(body?.topics);
    const access = splitTopicsByAccess(tier, normalizedRequestedTopics);
    if (access.denied.length > 0) {
      return NextResponse.json(
        {
          error: "Requested topics are not allowed for current user tier",
          userTier: tier,
          deniedTopics: access.denied,
          allowedTopics: getAllowedTopicsForTier(tier)
        },
        { status: 403 }
      );
    }

    const subscription = upsertSubscription({
      subscriberId: body?.subscriberId,
      transport: body?.transport,
      endpoint: body?.endpoint,
      topics: access.allowed,
      enabled: body?.enabled
    });
    return NextResponse.json({ subscription, userTier: tier }, { status: 200 });
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
