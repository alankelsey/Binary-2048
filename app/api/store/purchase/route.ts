import { NextResponse } from "next/server";
import { executePacketPurchase } from "@/lib/binary2048/store-purchase";
import { getStorePrincipal } from "@/lib/binary2048/store-auth";

type PurchaseBody = { subscriberId?: string; packetSku?: string; quantity?: number };

export async function POST(req: Request) {
  const principal = getStorePrincipal(req);
  if (!principal) {
    return NextResponse.json({ error: "Authenticated user required" }, { status: 401 });
  }
  if (process.env.BINARY2048_STORE_DIRECT_PURCHASE_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Direct store purchase is disabled; verified checkout is required" },
      { status: 503 }
    );
  }
  try {
    const body = ((await req.json().catch(() => ({}))) as PurchaseBody);
    const purchased = executePacketPurchase({
      subscriberId: principal.subscriberId,
      packetSku: body.packetSku ?? "",
      quantity: body.quantity,
      grantReason: "grant"
    });
    return NextResponse.json(purchased, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid purchase payload" },
      { status: 400 }
    );
  }
}
