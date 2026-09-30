import { GET } from "@/app/api/ops/leaderboard/route";
import { resetLeaderboard } from "@/lib/binary2048/leaderboard";

describe("GET /api/ops/leaderboard", () => {
  beforeEach(async () => {
    process.env.BINARY2048_ADMIN_TOKEN = "ops-test-token";
    process.env.BINARY2048_LEADERBOARD_STORE = "memory";
    await resetLeaderboard();
  });

  afterEach(async () => {
    delete process.env.BINARY2048_ADMIN_TOKEN;
    delete process.env.BINARY2048_LEADERBOARD_STORE;
    await resetLeaderboard();
  });

  it("rejects unauthenticated access", async () => {
    const res = await GET(new Request("http://localhost/api/ops/leaderboard"));
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns bounded read-only operations data and explicit source scope", async () => {
    const res = await GET(new Request(
      "http://localhost/api/ops/leaderboard?namespace=sandbox&seasonMode=preview&practice=1&limit=500&page=2",
      { headers: { "x-admin-token": "ops-test-token" } }
    ));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.source).toEqual({ backend: "memory", scope: "runtime", readOnly: true });
    expect(json.filters).toEqual({ namespace: "sandbox", seasonMode: "preview", includePractice: true });
    expect(json.limit).toBe(100);
    expect(json.page).toBe(1);
  });
});
