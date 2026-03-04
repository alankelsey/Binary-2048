import { GET } from "./route";

describe("GET /api/openapi", () => {
  it("returns OpenAPI JSON with expected top-level fields", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json?.openapi).toBe("3.1.0");
    expect(json?.info?.title).toBe("Binary-2048 API");
    expect(json?.paths?.["/api/games"]).toBeTruthy();
    expect(json?.paths?.["/api/openapi"]).toBeTruthy();
    expect(json?.paths?.["/api/ops/telemetry"]).toBeTruthy();
    expect(json?.paths?.["/api/user/data/export"]).toBeTruthy();
    expect(json?.paths?.["/api/user/data"]).toBeTruthy();
  });
});
