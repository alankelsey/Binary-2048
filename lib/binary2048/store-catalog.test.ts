import { getStorePacket, listStorePackets } from "@/lib/binary2048/store-catalog";

describe("store catalog", () => {
  it("lists active packet SKUs", () => {
    const packets = listStorePackets();
    expect(Array.isArray(packets)).toBe(true);
    expect(packets.length).toBeGreaterThan(0);
    expect(packets.every((packet) => packet.active)).toBe(true);
  });

  it("finds packet by sku and rejects unknown", () => {
    const packets = listStorePackets();
    const first = packets[0];
    expect(getStorePacket(first.packetSku)?.packetSku).toBe(first.packetSku);
    expect(getStorePacket("missing_pack")).toBeNull();
  });
});
