import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { buildAuthUiState } from "@/lib/binary2048/auth-ui";
import { getAuthUxMessages } from "@/lib/binary2048/auth-ux";
import { getInventory, listInventoryLedger } from "@/lib/binary2048/inventory";
import { listStorePackets } from "@/lib/binary2048/store-catalog";
import { storeSubscriberIdForSubject } from "@/lib/binary2048/store-auth";

export default async function StorePage() {
  const session = await getServerSession(authOptions);
  const authState = buildAuthUiState(session, authOptions.providers?.length ?? 0);
  const authUx = getAuthUxMessages(authState);
  const subject = authState.email ?? (authState.authenticated ? authState.displayName : null);
  const subscriberId = subject ? storeSubscriberIdForSubject(subject) : null;
  const packets = listStorePackets();
  const inventory = subscriberId ? getInventory(subscriberId) : null;
  const ledger = subscriberId ? listInventoryLedger(subscriberId, 20) : [];

  return (
    <main>
      <div className="card">
        <h1>Store</h1>
        <p className="brand-subtitle">Catalog and inventory view for quick ops checks.</p>
        <p className="meta-text">{authUx.paidStoreActions}</p>
        <p className="meta-text">{subscriberId ? "Account inventory loaded." : "Sign in to view account inventory."}</p>

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
        <pre>{JSON.stringify(inventory?.balances ?? {}, null, 2)}</pre>

        <h2>Ledger (latest 20)</h2>
        <pre>{JSON.stringify(ledger, null, 2)}</pre>
      </div>
    </main>
  );
}
