import { GET } from "@/app/api/ops/telemetry/route";
import { recordRouteTelemetry, resetOpsTelemetry } from "@/lib/binary2048/ops-telemetry";

describe("GET /api/ops/telemetry", () => {
  beforeEach(() => {
    process.env.BINARY2048_ADMIN_TOKEN = "ops-test-token";
    resetOpsTelemetry();
  });

  afterEach(() => {
    delete process.env.BINARY2048_ADMIN_TOKEN;
  });

  it("rejects unauthenticated access", async () => {
    const res = await GET(new Request("http://localhost/api/ops/telemetry"));
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns aggregated telemetry snapshot", async () => {
    recordRouteTelemetry({ route: "/api/bots/tournament", status: 200, durationMs: 25, costUnits: 4 });
    const res = await GET(new Request("http://localhost/api/ops/telemetry", {
      headers: { "x-admin-token": "ops-test-token" }
    }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.source).toEqual({ scope: "runtime", readOnly: true });
    expect(Array.isArray(json.routes)).toBe(true);
    expect(json.routes.some((item: { route: string }) => item.route === "/api/bots/tournament")).toBe(true);
  });
});
