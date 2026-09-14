import { NextResponse } from "next/server";
import { getInventory, grantInventory, listInventoryLedger } from "@/lib/binary2048/inventory";
import { getStorePrincipal, hasStoreAdminToken } from "@/lib/binary2048/store-auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const principal = getStorePrincipal(req);
  if (!principal) {
    return NextResponse.json({ error: "Authenticated user required" }, { status: 401 });
  }
  const requestedSubscriberId = url.searchParams.get("subscriberId");
  if (requestedSubscriberId && requestedSubscriberId !== principal.subscriberId) {
    return NextResponse.json({ error: "Inventory access denied" }, { status: 403 });
  }
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  try {
    const inventory = getInventory(principal.subscriberId);
    return NextResponse.json({
      inventory,
      ledger: listInventoryLedger(principal.subscriberId, limit),
      userTier: principal.tier,
      entitlements: principal.entitlements
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid inventory query" },
      { status: 400 }
    );
  }
}

export async function POST(req: Request) {
  if (!hasStoreAdminToken(req)) {
    return NextResponse.json({ error: "Admin token required" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const result = grantInventory({
      subscriberId: body?.subscriberId,
      sku: body?.sku,
      quantity: body?.quantity,
      reason: body?.reason
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid inventory grant payload" },
      { status: 400 }
    );
  }
}
