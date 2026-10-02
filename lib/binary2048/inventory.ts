import { usesSharedInventory, readSharedInventory, readSharedLedger, changeSharedInventory, deleteSharedInventory, type InventoryChange } from "@/lib/binary2048/inventory-mongo";
export type StoreSku = "undo_charge" | "wild_boost_pack" | "lock_breaker";

export type InventoryBalances = Record<StoreSku, number>;

export type InventoryRecord = {
  subscriberId: string;
  balances: InventoryBalances;
  updatedAtISO: string;
};

export type LedgerReason = "grant" | "consume" | "adjust" | "ad_reward";

export type InventoryLedgerEntry = {
  id: string;
  subscriberId: string;
  sku: StoreSku;
  delta: number;
  reason: LedgerReason;
  createdAtISO: string;
};

const globalStore = globalThis as typeof globalThis & {
  __binary2048_inventory_map?: Map<string, InventoryRecord>;
  __binary2048_inventory_ledger?: InventoryLedgerEntry[];
};

const inventories = globalStore.__binary2048_inventory_map ?? new Map<string, InventoryRecord>();
const ledger = globalStore.__binary2048_inventory_ledger ?? [];
globalStore.__binary2048_inventory_map = inventories;
globalStore.__binary2048_inventory_ledger = ledger;

const VALID_SKUS = new Set<StoreSku>(["undo_charge", "wild_boost_pack", "lock_breaker"]);

let ledgerIdCounter = 1;

function nowISO() {
  return new Date().toISOString();
}

function emptyBalances(): InventoryBalances {
  return {
    undo_charge: 0,
    wild_boost_pack: 0,
    lock_breaker: 0
  };
}

function parsePositiveQuantity(quantity: unknown) {
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("quantity must be a positive integer");
  }
  return quantity;
}

function parseSubscriberId(subscriberId: unknown) {
  if (typeof subscriberId !== "string" || subscriberId.trim().length < 2) {
    throw new Error("subscriberId is required");
  }
  return subscriberId.trim();
}

function parseSku(sku: unknown): StoreSku {
  if (typeof sku !== "string" || !VALID_SKUS.has(sku as StoreSku)) {
    throw new Error("sku must be one of: undo_charge, wild_boost_pack, lock_breaker");
  }
  return sku as StoreSku;
}

function appendLedgerEntry(entry: Omit<InventoryLedgerEntry, "id" | "createdAtISO">): InventoryLedgerEntry {
  const created: InventoryLedgerEntry = {
    id: `led_${ledgerIdCounter++}`,
    createdAtISO: nowISO(),
    ...entry
  };
  ledger.unshift(created);
  return created;
}

function memoryGetInventory(subscriberIdRaw: unknown): InventoryRecord {
  const subscriberId = parseSubscriberId(subscriberIdRaw);
  const existing = inventories.get(subscriberId);
  if (existing) return existing;
  const created: InventoryRecord = {
    subscriberId,
    balances: emptyBalances(),
    updatedAtISO: nowISO()
  };
  inventories.set(subscriberId, created);
  return created;
}

function memoryGetExistingInventory(subscriberIdRaw: unknown): InventoryRecord | null {
  const subscriberId = parseSubscriberId(subscriberIdRaw);
  return inventories.get(subscriberId) ?? null;
}

function memoryListInventoryLedger(subscriberIdRaw: unknown, limitRaw?: unknown): InventoryLedgerEntry[] {
  const subscriberId = parseSubscriberId(subscriberIdRaw);
  const limit = typeof limitRaw === "number" && Number.isInteger(limitRaw) && limitRaw > 0 ? limitRaw : 50;
  return ledger.filter((entry) => entry.subscriberId === subscriberId).slice(0, limit);
}

function memoryGrantInventory(input: {
  subscriberId: unknown;
  sku: unknown;
  quantity: unknown;
  reason?: LedgerReason;
}): { inventory: InventoryRecord; ledgerEntry: InventoryLedgerEntry } {
  const subscriberId = parseSubscriberId(input.subscriberId);
  const sku = parseSku(input.sku);
  const quantity = parsePositiveQuantity(input.quantity);
  const reason = input.reason ?? "grant";

  const current = memoryGetInventory(subscriberId);
  const next: InventoryRecord = {
    ...current,
    balances: {
      ...current.balances,
      [sku]: current.balances[sku] + quantity
    },
    updatedAtISO: nowISO()
  };
  inventories.set(subscriberId, next);
  const ledgerEntry = appendLedgerEntry({ subscriberId, sku, delta: quantity, reason });
  return { inventory: next, ledgerEntry };
}

function memoryConsumeInventory(input: {
  subscriberId: unknown;
  sku: unknown;
  quantity: unknown;
  reason?: LedgerReason;
}): { inventory: InventoryRecord; ledgerEntry: InventoryLedgerEntry } {
  const subscriberId = parseSubscriberId(input.subscriberId);
  const sku = parseSku(input.sku);
  const quantity = parsePositiveQuantity(input.quantity);
  const reason = input.reason ?? "consume";
  const current = memoryGetInventory(subscriberId);

  if (current.balances[sku] < quantity) {
    throw new Error(`insufficient inventory for ${sku}`);
  }

  const next: InventoryRecord = {
    ...current,
    balances: {
      ...current.balances,
      [sku]: current.balances[sku] - quantity
    },
    updatedAtISO: nowISO()
  };
  inventories.set(subscriberId, next);
  const ledgerEntry = appendLedgerEntry({ subscriberId, sku, delta: -quantity, reason });
  return { inventory: next, ledgerEntry };
}

export function resetInventoryStore() {
  memoryReceipts.clear();
  inventories.clear();
  ledger.length = 0;
  ledgerIdCounter = 1;
}

function memoryRemoveInventoryBySubscriber(subscriberIdRaw: unknown): {
  removedInventory: boolean;
  removedLedgerEntries: number;
} {
  const subscriberId = parseSubscriberId(subscriberIdRaw);
  const removedInventory = inventories.delete(subscriberId);
  let removedLedgerEntries = 0;
  for (let i = ledger.length - 1; i >= 0; i -= 1) {
    if (ledger[i]?.subscriberId !== subscriberId) continue;
    ledger.splice(i, 1);
    removedLedgerEntries += 1;
  }
  return { removedInventory, removedLedgerEntries };
}

export async function getInventory(subscriberIdRaw: unknown): Promise<InventoryRecord> {
  const subscriberId = parseSubscriberId(subscriberIdRaw);
  if (!usesSharedInventory()) return memoryGetInventory(subscriberId);
  return await readSharedInventory(subscriberId) ?? { subscriberId, balances: emptyBalances(), updatedAtISO: nowISO() };
}
export async function getExistingInventory(subscriberIdRaw: unknown): Promise<InventoryRecord | null> {
  const subscriberId = parseSubscriberId(subscriberIdRaw);
  return usesSharedInventory() ? readSharedInventory(subscriberId) : memoryGetExistingInventory(subscriberId);
}
export async function listInventoryLedger(subscriberIdRaw: unknown, limitRaw?: unknown): Promise<InventoryLedgerEntry[]> {
  const subscriberId = parseSubscriberId(subscriberIdRaw);
  const limit = typeof limitRaw === "number" && Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 1000) : 50;
  return usesSharedInventory() ? readSharedLedger(subscriberId, limit) : memoryListInventoryLedger(subscriberId, limit);
}
export async function grantInventory(input: { subscriberId: unknown; sku: unknown; quantity: unknown; reason?: LedgerReason }) {
  const subscriberId = parseSubscriberId(input.subscriberId);
  const sku = parseSku(input.sku);
  const quantity = parsePositiveQuantity(input.quantity);
  if (!usesSharedInventory()) return memoryGrantInventory(input);
  const result = await changeSharedInventory(subscriberId, [{ sku, delta: quantity, reason: input.reason ?? "grant" }]);
  return { inventory: result.inventory, ledgerEntry: result.entries[0] };
}
export async function consumeInventory(input: { subscriberId: unknown; sku: unknown; quantity: unknown; reason?: LedgerReason }) {
  const subscriberId = parseSubscriberId(input.subscriberId);
  const sku = parseSku(input.sku);
  const quantity = parsePositiveQuantity(input.quantity);
  if (!usesSharedInventory()) return memoryConsumeInventory(input);
  const result = await changeSharedInventory(subscriberId, [{ sku, delta: -quantity, reason: input.reason ?? "consume" }]);
  return { inventory: result.inventory, ledgerEntry: result.entries[0] };
}
export async function removeInventoryBySubscriber(subscriberIdRaw: unknown) {
  const subscriberId = parseSubscriberId(subscriberIdRaw);
  return usesSharedInventory() ? (await deleteSharedInventory(subscriberId))! : memoryRemoveInventoryBySubscriber(subscriberId);
}
const memoryReceipts = new Map<string, Awaited<ReturnType<typeof changeSharedInventory>>>();
export async function grantInventoryPacket(subscriberIdRaw: unknown, changes: InventoryChange[], paymentRef?: string) {
  const subscriberId = parseSubscriberId(subscriberIdRaw);
  for (const change of changes) { parseSku(change.sku); parsePositiveQuantity(change.delta); }
  if (usesSharedInventory()) return changeSharedInventory(subscriberId, changes, paymentRef);
  const existing = paymentRef ? memoryReceipts.get(paymentRef) : undefined;
  if (existing) return { ...existing, alreadyProcessed: true };
  const results = changes.map(change => memoryGrantInventory({ subscriberId, sku: change.sku, quantity: change.delta, reason: change.reason }));
  const result = { inventory: memoryGetInventory(subscriberId), entries: results.map(item => item.ledgerEntry), alreadyProcessed: false };
  if (paymentRef) memoryReceipts.set(paymentRef, result);
  return result;
}
