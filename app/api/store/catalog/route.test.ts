import { GET } from "@/app/api/store/catalog/route";

describe("api store catalog", () => {
  it("returns active store packets", async () => {
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(json.packets)).toBe(true);
    expect(json.packets.length).toBeGreaterThan(0);
  });
});
