import type { StoreSku } from "@/lib/binary2048/inventory";

export type StorePacketGrant = {
  sku: StoreSku;
  quantity: number;
};

export type StorePacket = {
  packetSku: string;
  label: string;
  description: string;
  priceCents: number;
  grants: StorePacketGrant[];
  active: boolean;
};

const STORE_PACKETS: StorePacket[] = [
  {
    packetSku: "pack_undo_starter",
    label: "Undo Starter Pack",
    description: "Three undo charges for recovery turns.",
    priceCents: 299,
    grants: [{ sku: "undo_charge", quantity: 3 }],
    active: true
  },
  {
    packetSku: "pack_wild_surge",
    label: "Wild Surge Pack",
    description: "Wildcard boost bundle for aggressive runs.",
    priceCents: 499,
    grants: [
      { sku: "wild_boost_pack", quantity: 2 },
      { sku: "undo_charge", quantity: 1 }
    ],
    active: true
  },
  {
    packetSku: "pack_lock_breaker",
    label: "Lock Breaker Pack",
    description: "Lock breaker utility + emergency undo.",
    priceCents: 599,
    grants: [
      { sku: "lock_breaker", quantity: 2 },
      { sku: "undo_charge", quantity: 1 }
    ],
    active: true
  }
];

export function listStorePackets() {
  return STORE_PACKETS.filter((packet) => packet.active);
}

export function getStorePacket(packetSku: string): StorePacket | null {
  const found = STORE_PACKETS.find((packet) => packet.packetSku === packetSku && packet.active);
  return found ?? null;
}
