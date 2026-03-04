import { NextResponse } from "next/server";
import { getVerifiedAuthClaims } from "@/lib/binary2048/auth-context";
import { removeInventoryBySubscriber } from "@/lib/binary2048/inventory";
import { removeLeaderboardEntriesByPlayer } from "@/lib/binary2048/leaderboard";
import { removeSubscriptionsBySubscriber } from "@/lib/binary2048/subscriptions";

export async function DELETE(req: Request) {
  const claims = getVerifiedAuthClaims(req);
  if (!claims?.sub) {
    return NextResponse.json({ error: "Authenticated user required" }, { status: 401 });
  }
  const subscriberId = claims.sub;
  const removedSubscriptions = removeSubscriptionsBySubscriber(subscriberId);
  const removedLeaderboardEntries = removeLeaderboardEntriesByPlayer(subscriberId);
  const inventoryResult = removeInventoryBySubscriber(subscriberId);

  return NextResponse.json(
    {
      subscriberId,
      deletedAtISO: new Date().toISOString(),
      removed: {
        subscriptions: removedSubscriptions,
        leaderboardEntries: removedLeaderboardEntries,
        inventoryRecord: inventoryResult.removedInventory ? 1 : 0,
        inventoryLedgerEntries: inventoryResult.removedLedgerEntries
      }
    },
    { status: 200 }
  );
}

