import { POST } from "@/app/api/ops/storage/smoke/route";
import { resetRunStoreForTests } from "@/lib/binary2048/run-store";
import { resetSessionStoreForTests } from "@/lib/binary2048/session-store";
import { resetLeaderboard } from "@/lib/binary2048/leaderboard";

describe("POST /api/ops/storage/smoke", () => {
  beforeEach(async () => {
    process.env.BINARY2048_ADMIN_TOKEN = "ops-admin-token";
    process.env.BINARY2048_RUN_STORE = "memory";
    process.env.BINARY2048_SESSION_STORE = "memory";
    process.env.BINARY2048_LEADERBOARD_STORE = "memory";
    process.env.BINARY2048_REPLAY_ARTIFACT_STORE = "inline";
    resetRunStoreForTests();
    resetSessionStoreForTests();
    await resetLeaderboard();
  });

  afterEach(async () => {
    delete process.env.BINARY2048_ADMIN_TOKEN;
    delete process.env.BINARY2048_RUN_STORE;
    delete process.env.BINARY2048_SESSION_STORE;
    delete process.env.BINARY2048_LEADERBOARD_STORE;
    delete process.env.BINARY2048_REPLAY_ARTIFACT_STORE;
    resetRunStoreForTests();
    resetSessionStoreForTests();
    await resetLeaderboard();
  });

  it("rejects when admin token is missing", async () => {
    const res = await POST(new Request("http://localhost/api/ops/storage/smoke", { method: "POST" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("writes and loads a smoke run", async () => {
    const req = new Request("http://localhost/api/ops/storage/smoke", {
      method: "POST",
      headers: { "x-admin-token": "ops-admin-token" }
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.persisted.replayStorage).toBe("inline");
    expect(json.persisted.hasReplayPayload).toBe(true);
    expect(json.persisted.leaderboardRoundTrip).toBe(true);
    expect(json.persisted.leaderboardRemoved).toBe(1);
    expect(json.env.leaderboardStore).toBe("memory");
  });
});
