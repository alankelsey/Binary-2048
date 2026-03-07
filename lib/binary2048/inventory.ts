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

export function getInventory(subscriberIdRaw: unknown): InventoryRecord {
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

export function getExistingInventory(subscriberIdRaw: unknown): InventoryRecord | null {
  const subscriberId = parseSubscriberId(subscriberIdRaw);
  return inventories.get(subscriberId) ?? null;
}

export function listInventoryLedger(subscriberIdRaw: unknown, limitRaw?: unknown): InventoryLedgerEntry[] {
  const subscriberId = parseSubscriberId(subscriberIdRaw);
  const limit = typeof limitRaw === "number" && Number.isInteger(limitRaw) && limitRaw > 0 ? limitRaw : 50;
  return ledger.filter((entry) => entry.subscriberId === subscriberId).slice(0, limit);
}

export function grantInventory(input: {
  subscriberId: unknown;
  sku: unknown;
  quantity: unknown;
  reason?: LedgerReason;
}): { inventory: InventoryRecord; ledgerEntry: InventoryLedgerEntry } {
  const subscriberId = parseSubscriberId(input.subscriberId);
  const sku = parseSku(input.sku);
  const quantity = parsePositiveQuantity(input.quantity);
  const reason = input.reason ?? "grant";

  const current = getInventory(subscriberId);
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

export function consumeInventory(input: {
  subscriberId: unknown;
  sku: unknown;
  quantity: unknown;
  reason?: LedgerReason;
}): { inventory: InventoryRecord; ledgerEntry: InventoryLedgerEntry } {
  const subscriberId = parseSubscriberId(input.subscriberId);
  const sku = parseSku(input.sku);
  const quantity = parsePositiveQuantity(input.quantity);
  const reason = input.reason ?? "consume";
  const current = getInventory(subscriberId);

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
  inventories.clear();
  ledger.length = 0;
  ledgerIdCounter = 1;
}

export function removeInventoryBySubscriber(subscriberIdRaw: unknown): {
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
