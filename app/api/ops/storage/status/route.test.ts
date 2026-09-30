import { GET } from "@/app/api/ops/storage/status/route";

describe("GET /api/ops/storage/status", () => {
  beforeEach(() => {
    process.env.BINARY2048_ADMIN_TOKEN = "ops-test-token";
    process.env.BINARY2048_LEADERBOARD_STORE = "mongo";
    process.env.BINARY2048_RATE_LIMIT_STORE = "mongo";
    process.env.BINARY2048_MONGO_URI = "mongodb://not-contacted.invalid";
  });

  afterEach(() => {
    delete process.env.BINARY2048_ADMIN_TOKEN;
    delete process.env.BINARY2048_LEADERBOARD_STORE;
    delete process.env.BINARY2048_RATE_LIMIT_STORE;
    delete process.env.BINARY2048_MONGO_URI;
  });

  it("rejects unauthenticated access", async () => {
    expect((await GET(new Request("http://localhost/api/ops/storage/status"))).status).toBe(401);
  });

  it("reports configuration without running a connectivity probe", async () => {
    const res = await GET(new Request("http://localhost/api/ops/storage/status", {
      headers: { "x-admin-token": "ops-test-token" }
    }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.passive).toBe(true);
    expect(json.performsConnectivityCheck).toBe(false);
    expect(json.stores.leaderboard).toEqual({ mode: "mongo", scope: "shared" });
    expect(json.activeProbe).toEqual({ method: "POST", path: "/api/ops/storage/smoke" });
  });
});
