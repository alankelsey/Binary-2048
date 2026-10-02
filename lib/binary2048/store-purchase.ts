import { grantInventoryPacket, type LedgerReason } from "@/lib/binary2048/inventory";
import { getStorePacket } from "@/lib/binary2048/store-catalog";

export async function executePacketPurchase(input: {
  subscriberId: string; packetSku: string; quantity?: number; grantReason?: LedgerReason; paymentRef?: string;
}) {
  if (!input.subscriberId) throw new Error("subscriberId is required");
  if (!input.packetSku) throw new Error("packetSku is required");
  const packet = getStorePacket(input.packetSku);
  if (!packet) throw new Error("Unknown packetSku");
  const quantity = input.quantity ?? 1;
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) throw new Error("Invalid purchase quantity");
  const result = await grantInventoryPacket(input.subscriberId, packet.grants.map(grant => ({
    sku: grant.sku, delta: grant.quantity * quantity, reason: input.grantReason ?? "grant"
  })), input.paymentRef);
  return {
    packetSku: packet.packetSku, quantity, totalPriceCents: packet.priceCents * quantity,
    grants: result.entries.map(entry => ({ sku: entry.sku, quantity: entry.delta, ledgerEntryId: entry.id })),
    inventory: result.inventory, alreadyProcessed: result.alreadyProcessed
  };
}
