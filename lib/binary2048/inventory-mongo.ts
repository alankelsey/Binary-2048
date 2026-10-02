import { createHash, randomUUID } from "crypto";
import { sharedMongoClient, sharedMongoDb } from "@/lib/binary2048/shared-mongo";
import type { InventoryRecord, InventoryLedgerEntry, LedgerReason, StoreSku } from "@/lib/binary2048/inventory";

export type InventoryChange = { sku: StoreSku; delta: number; reason: LedgerReason };
export type InventoryChangeResult = { inventory: InventoryRecord; entries: InventoryLedgerEntry[]; alreadyProcessed: boolean };
type Receipt = { _id: string; subscriberId?: string; result?: InventoryChangeResult; createdAt: Date };
let initialized: Promise<void> | undefined;
export const usesSharedInventory = () => process.env.BINARY2048_INVENTORY_STORE === "mongo";

async function collections() {
  const db = await sharedMongoDb();
  const inventories = db.collection<InventoryRecord>("inventory_balances");
  const ledger = db.collection<InventoryLedgerEntry>("inventory_ledger");
  const receipts = db.collection<Receipt>("inventory_receipts");
  if (!initialized) initialized = Promise.all([
    inventories.createIndex({ subscriberId: 1 }, { unique: true }),
    ledger.createIndex({ subscriberId: 1, createdAtISO: -1, id: -1 }),
    receipts.createIndex({ subscriberId: 1 })
  ]).then(() => undefined).catch(() => { initialized = undefined; throw new Error("Inventory storage is unavailable"); });
  await initialized;
  return { inventories, ledger, receipts };
}

export async function readSharedInventory(subscriberId: string) {
  const { inventories } = await collections();
  return inventories.findOne({ subscriberId }, { projection: { _id: 0 } });
}
export async function readSharedLedger(subscriberId: string, limit: number) {
  const { ledger } = await collections();
  return ledger.find({ subscriberId }, { projection: { _id: 0 } }).sort({ createdAtISO: -1, id: -1 }).limit(Math.min(limit, 1000)).toArray();
}

export async function changeSharedInventory(subscriberId: string, changes: InventoryChange[], paymentRef?: string): Promise<InventoryChangeResult> {
  const { inventories, ledger, receipts } = await collections();
  const client = await sharedMongoClient();
  const session = client.startSession();
  const receiptId = paymentRef ? createHash("sha256").update(paymentRef).digest("hex") : undefined;
  try {
    // Retry a first-insert race: unique-key conflicts are not retried by all drivers.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await session.withTransaction(async () => {
          if (receiptId) {
            const prior = await receipts.findOne({ _id: receiptId }, { session });
            if (prior) return { ...(prior.result ?? { inventory: { subscriberId, balances: { undo_charge: 0, wild_boost_pack: 0, lock_breaker: 0 }, updatedAtISO: prior.createdAt.toISOString() }, entries: [] }), alreadyProcessed: true };
          }
          const current = await inventories.findOne({ subscriberId }, { session });
          const inventory: InventoryRecord = current ? { subscriberId, balances: { ...current.balances }, updatedAtISO: new Date().toISOString() } : {
            subscriberId, balances: { undo_charge: 0, wild_boost_pack: 0, lock_breaker: 0 }, updatedAtISO: new Date().toISOString()
          };
          const entries = changes.map(({ sku, delta, reason }) => {
            const balance = inventory.balances[sku] + delta;
            if (!Number.isSafeInteger(balance) || balance < 0) throw new Error(`insufficient inventory for ${sku}`);
            inventory.balances[sku] = balance;
            return { id: `led_${randomUUID()}`, subscriberId, sku, delta, reason, createdAtISO: inventory.updatedAtISO };
          });
          await inventories.replaceOne({ subscriberId }, inventory, { upsert: true, session });
          if (entries.length) await ledger.insertMany(entries, { session });
          const result: InventoryChangeResult = { inventory, entries, alreadyProcessed: false };
          if (receiptId) await receipts.insertOne({ _id: receiptId, subscriberId, result, createdAt: new Date() }, { session });
          return result;
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, maxCommitTimeMS: 5000 });
        if (!result) throw new Error("Inventory transaction did not commit");
        return result;
      } catch (error) {
        if ((error as { code?: number }).code !== 11000 || attempt === 2) throw error;
      }
    }
    throw new Error("Inventory transaction did not commit");
  } finally { await session.endSession(); }
}

export async function deleteSharedInventory(subscriberId: string) {
  const { inventories, ledger, receipts } = await collections();
  const session = (await sharedMongoClient()).startSession();
  try {
    return await session.withTransaction(async () => {
      const inventory = await inventories.deleteOne({ subscriberId }, { session });
      const entries = await ledger.deleteMany({ subscriberId }, { session });
      // Keep only the unlinked payment digest so an old signed webhook cannot regrant after deletion.
      await receipts.updateMany({ subscriberId }, { $unset: { subscriberId: "", result: "" } }, { session });
      return { removedInventory: inventory.deletedCount > 0, removedLedgerEntries: entries.deletedCount };
    }, { writeConcern: { w: "majority" }, maxCommitTimeMS: 5000 });
  } finally { await session.endSession(); }
}
