import { grantInventory, type LedgerReason } from "@/lib/binary2048/inventory";
import { getStorePacket } from "@/lib/binary2048/store-catalog";

function parsePositiveInt(value: unknown, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function executePacketPurchase(input: {
  subscriberId: string;
  packetSku: string;
  quantity?: number;
  grantReason?: LedgerReason;
}) {
  if (!input.subscriberId) {
    throw new Error("subscriberId is required");
  }
  if (!input.packetSku) {
    throw new Error("packetSku is required");
  }

  const packet = getStorePacket(input.packetSku);
  if (!packet) {
    throw new Error("Unknown packetSku");
  }

  const quantity = parsePositiveInt(input.quantity, 1);
  const grants = [];
  let inventorySnapshot: ReturnType<typeof grantInventory>["inventory"] | null = null;
  for (let i = 0; i < quantity; i++) {
    for (const grant of packet.grants) {
      const result = grantInventory({
        subscriberId: input.subscriberId,
        sku: grant.sku,
        quantity: grant.quantity,
        reason: input.grantReason ?? "grant"
      });
      inventorySnapshot = result.inventory;
      grants.push({
        sku: grant.sku,
        quantity: grant.quantity,
        ledgerEntryId: result.ledgerEntry.id
      });
    }
  }

  return {
    packetSku: packet.packetSku,
    quantity,
    totalPriceCents: packet.priceCents * quantity,
    grants,
    inventory: inventorySnapshot
  };
}

