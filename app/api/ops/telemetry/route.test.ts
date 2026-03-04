import { GET } from "@/app/api/ops/telemetry/route";
import { recordRouteTelemetry, resetOpsTelemetry } from "@/lib/binary2048/ops-telemetry";

describe("GET /api/ops/telemetry", () => {
  beforeEach(() => {
    resetOpsTelemetry();
  });

  it("returns aggregated telemetry snapshot", async () => {
    recordRouteTelemetry({ route: "/api/bots/tournament", status: 200, durationMs: 25, costUnits: 4 });
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(json.routes)).toBe(true);
    expect(json.routes.some((item: { route: string }) => item.route === "/api/bots/tournament")).toBe(true);
  });
});

