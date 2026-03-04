import { NextResponse } from "next/server";
import { grantInventory } from "@/lib/binary2048/inventory";
import { getStorePacket } from "@/lib/binary2048/store-catalog";

type PurchaseBody = {
  subscriberId?: string;
  packetSku?: string;
  quantity?: number;
};

function parsePositiveInt(value: unknown, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export async function POST(req: Request) {
  try {
    const body = ((await req.json().catch(() => ({}))) as PurchaseBody);
    if (!body.subscriberId) {
      return NextResponse.json({ error: "subscriberId is required" }, { status: 400 });
    }
    if (!body.packetSku) {
      return NextResponse.json({ error: "packetSku is required" }, { status: 400 });
    }

    const packet = getStorePacket(body.packetSku);
    if (!packet) {
      return NextResponse.json({ error: "Unknown packetSku" }, { status: 400 });
    }

    const quantity = parsePositiveInt(body.quantity, 1);
    const grants = [];
    let inventorySnapshot: ReturnType<typeof grantInventory>["inventory"] | null = null;
    for (let i = 0; i < quantity; i++) {
      for (const grant of packet.grants) {
        const result = grantInventory({
          subscriberId: body.subscriberId,
          sku: grant.sku,
          quantity: grant.quantity,
          reason: "grant"
        });
        inventorySnapshot = result.inventory;
        grants.push({
          sku: grant.sku,
          quantity: grant.quantity,
          ledgerEntryId: result.ledgerEntry.id
        });
      }
    }

    return NextResponse.json(
      {
        packetSku: packet.packetSku,
        quantity,
        totalPriceCents: packet.priceCents * quantity,
        grants,
        inventory: inventorySnapshot
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid purchase payload" },
      { status: 400 }
    );
  }
}
