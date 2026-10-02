import { consumeInventory, getInventory, grantInventory, listInventoryLedger } from "@/lib/binary2048/inventory";

describe("inventory store", () => {
  it("creates default inventory with zero balances", async () => {
    const inventory = (await getInventory("inv-user-default"));
    expect(inventory.balances.undo_charge).toBe(0);
    expect(inventory.balances.wild_boost_pack).toBe(0);
    expect(inventory.balances.lock_breaker).toBe(0);
  });

  it("grants and consumes inventory with ledger tracking", async () => {
    const granted = (await grantInventory({
      subscriberId: "inv-user-ops",
      sku: "undo_charge",
      quantity: 3
    }));
    expect(granted.inventory.balances.undo_charge).toBe(3);
    expect(granted.ledgerEntry.delta).toBe(3);

    const consumed = (await consumeInventory({
      subscriberId: "inv-user-ops",
      sku: "undo_charge",
      quantity: 2
    }));
    expect(consumed.inventory.balances.undo_charge).toBe(1);
    expect(consumed.ledgerEntry.delta).toBe(-2);

    const ledger = (await listInventoryLedger("inv-user-ops"));
    expect(ledger.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects over-consume", async () => {
    await expect(consumeInventory({
        subscriberId: "inv-user-none",
        sku: "lock_breaker",
        quantity: 1
      })).rejects.toThrow("insufficient inventory");
  });
});
