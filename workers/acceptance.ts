import { randomUUID } from "crypto";
import assert from "node:assert/strict";
import { sharedMongoDb, sharedMongoClient } from "@/lib/binary2048/shared-mongo";
import { MongoSessionStore, SessionConflictError } from "@/lib/binary2048/session-store";
import { createSession } from "@/lib/binary2048/sessions";
import { grantInventory, consumeInventory, getInventory, listInventoryLedger, removeInventoryBySubscriber } from "@/lib/binary2048/inventory";
import { executePacketPurchase } from "@/lib/binary2048/store-purchase";
import { readOpsValue, writeOpsValue } from "@/lib/binary2048/ops-shared";

async function main() {
  const suffix = randomUUID();
  const subject = `v1-acceptance-${suffix}`;
  const collectionName = `v1_acceptance_sessions_${suffix.replaceAll('-', '')}`;
  process.env.BINARY2048_INVENTORY_STORE = "mongo";
  process.env.BINARY2048_SESSION_STORE = "memory";
  const db = await sharedMongoDb();
  try {
    await grantInventory({ subscriberId: subject, sku: "undo_charge", quantity: 3 });
    const consumed = await Promise.allSettled([1,2].map(() => consumeInventory({ subscriberId: subject, sku: "undo_charge", quantity: 2 })));
    assert.equal(consumed.filter(result => result.status === "fulfilled").length, 1);
    assert.equal((await getInventory(subject)).balances.undo_charge, 1);
    assert.equal((await listInventoryLedger(subject)).length, 2);
    const purchases = await Promise.all([1,2].map(() => executePacketPurchase({ subscriberId: subject, packetSku: "pack_undo_starter", paymentRef: `acceptance-${suffix}` })));
    assert.equal(purchases.filter(result => !result.alreadyProcessed).length, 1);
    assert.equal((await getInventory(subject)).balances.undo_charge, 4);
    const session = await createSession({ seed: 205 });
    // Separate adapters model separate cold application instances.
    const a = new MongoSessionStore(async () => db.collection(collectionName) as never);
    const b = new MongoSessionStore(async () => db.collection(collectionName) as never);
    await a.set(session.current.id, JSON.parse(JSON.stringify(session)));
    const cold = (await b.get(session.current.id))!;
    assert.equal(cold.current.id, session.current.id);
    const stale = (await a.get(session.current.id))!;
    cold.undoUsed = 1;
    await b.set(cold.current.id, cold);
    await assert.rejects(a.set(stale.current.id, stale), SessionConflictError);
    await b.delete(cold.current.id);
    assert.equal(await a.get(cold.current.id), null);
    await writeOpsValue(`acceptance:${suffix}`, { accepted: true });
    assert.deepEqual(await readOpsValue(`acceptance:${suffix}`), { accepted: true });
    await removeInventoryBySubscriber(subject);
    const replay = await executePacketPurchase({ subscriberId: subject, packetSku: "pack_undo_starter", paymentRef: `acceptance-${suffix}` });
    assert.equal(replay.alreadyProcessed, true);
    assert.equal((await getInventory(subject)).balances.undo_charge, 0);
    console.log(JSON.stringify({ inventoryAtomicConsumption: "passed", paymentGrantOnce: "passed", coldSessionHydration: "passed", competingSessionWriter: "passed", durableSessionDeletion: "passed", sharedOps: "passed", deletedPaymentReplay: "passed" }));
  } finally {
    await removeInventoryBySubscriber(subject);
    await db.collection(collectionName).drop().catch(() => undefined);
    await db.collection("ops_state").deleteOne({ _id: `acceptance:${suffix}` } as never);
    const { createHash } = await import("node:crypto");
    await db.collection("inventory_receipts").deleteOne({ _id: createHash("sha256").update(`acceptance-${suffix}`).digest("hex") } as never);
    await (await sharedMongoClient()).close();
  }
}
main().catch(() => { console.error("V1 shared-store acceptance failed; credentials and driver details suppressed."); process.exitCode = 1; });
