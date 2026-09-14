import { NextResponse } from "next/server";
import { consumeInventory } from "@/lib/binary2048/inventory";
import { getStorePrincipal } from "@/lib/binary2048/store-auth";

export async function POST(req: Request) {
  const principal = getStorePrincipal(req);
  if (!principal) {
    return NextResponse.json({ error: "Authenticated user required" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const result = consumeInventory({
      subscriberId: principal.subscriberId,
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
