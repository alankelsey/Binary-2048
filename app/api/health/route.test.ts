import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns ok service payload", async () => {
    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.service).toBe("binary-2048");
    expect(typeof json.version).toBe("string");
    expect(typeof json.commit).toBe("string");
  });
});
