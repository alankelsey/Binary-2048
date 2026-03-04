import { NextResponse } from "next/server";
import { getInventory, grantInventory, listInventoryLedger } from "@/lib/binary2048/inventory";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const subscriberId = url.searchParams.get("subscriberId");
  if (!subscriberId) {
    return NextResponse.json({ error: "subscriberId query param is required" }, { status: 400 });
  }
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  try {
    const inventory = getInventory(subscriberId);
    return NextResponse.json({
      inventory,
      ledger: listInventoryLedger(subscriberId, limit)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid inventory query" },
      { status: 400 }
    );
  }
}

export async function POST(req: Request) {
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
