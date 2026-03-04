import { NextResponse } from "next/server";
import { getVerifiedAuthClaims } from "@/lib/binary2048/auth-context";
import { getExistingInventory, listInventoryLedger } from "@/lib/binary2048/inventory";
import { listLeaderboardEntriesByPlayer } from "@/lib/binary2048/leaderboard";
import { listSubscriptions } from "@/lib/binary2048/subscriptions";

export async function GET(req: Request) {
  const claims = getVerifiedAuthClaims(req);
  if (!claims?.sub) {
    return NextResponse.json({ error: "Authenticated user required" }, { status: 401 });
  }
  const subscriberId = claims.sub;
  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 100;
  return NextResponse.json(
    {
      subscriberId,
      exportedAtISO: new Date().toISOString(),
      inventory: getExistingInventory(subscriberId),
      ledger: listInventoryLedger(subscriberId, Number.isFinite(limit) ? limit : 100),
      subscriptions: listSubscriptions(subscriberId),
      leaderboard: listLeaderboardEntriesByPlayer(subscriberId, Number.isFinite(limit) ? limit : 100)
    },
    { status: 200 }
  );
}

