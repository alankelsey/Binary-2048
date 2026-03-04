import { NextResponse } from "next/server";
import { executePacketPurchase } from "@/lib/binary2048/store-purchase";

type PurchaseBody = { subscriberId?: string; packetSku?: string; quantity?: number };

export async function POST(req: Request) {
  try {
    const body = ((await req.json().catch(() => ({}))) as PurchaseBody);
    const purchased = executePacketPurchase({
      subscriberId: body.subscriberId ?? "",
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
