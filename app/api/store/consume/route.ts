import { NextResponse } from "next/server";
import { consumeInventory } from "@/lib/binary2048/inventory";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = consumeInventory({
      subscriberId: body?.subscriberId,
      sku: body?.sku,
      quantity: body?.quantity,
      reason: body?.reason
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid consume payload" },
      { status: 400 }
    );
  }
}
