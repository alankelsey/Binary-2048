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
  let removedLeaderboardEntries: number;
  try {
    removedLeaderboardEntries = await removeLeaderboardEntriesByPlayer(subscriberId);
  } catch {
    return NextResponse.json({ error: "User data deletion is temporarily unavailable" }, { status: 503 });
  }
  const removedSubscriptions = removeSubscriptionsBySubscriber(subscriberId);
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
