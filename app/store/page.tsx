import { getInventory, listInventoryLedger } from "@/lib/binary2048/inventory";
import { listStorePackets } from "@/lib/binary2048/store-catalog";

type StorePageProps = {
  searchParams?: Promise<{ subscriberId?: string }>;
};

export default async function StorePage({ searchParams }: StorePageProps) {
  const params = (await searchParams) ?? {};
  const subscriberId = params.subscriberId?.trim() || "guest_demo";
  const packets = listStorePackets();
  const inventory = getInventory(subscriberId);
  const ledger = listInventoryLedger(subscriberId, 20);

  return (
    <main>
      <div className="card">
        <h1>Store</h1>
        <p className="brand-subtitle">Catalog and inventory view for quick ops checks.</p>
        <p className="meta-text">Subscriber: {subscriberId}</p>

        <h2>Catalog</h2>
        <div className="meta-list">
          {packets.map((packet) => (
            <div key={packet.packetSku}>
              <strong>{packet.label}</strong> ({packet.packetSku}) - ${(packet.priceCents / 100).toFixed(2)}
              <div className="meta-text">{packet.description}</div>
            </div>
          ))}
        </div>

        <h2>Inventory</h2>
        <pre>{JSON.stringify(inventory.balances, null, 2)}</pre>

        <h2>Ledger (latest 20)</h2>
        <pre>{JSON.stringify(ledger, null, 2)}</pre>
      </div>
    </main>
  );
}
