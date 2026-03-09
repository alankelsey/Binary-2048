import { GET } from "@/app/api/ops/storage/health/route";
import { resetRunStoreForTests } from "@/lib/binary2048/run-store";
import { resetSessionStoreForTests } from "@/lib/binary2048/session-store";

describe("GET /api/ops/storage/health", () => {
  beforeEach(() => {
    process.env.BINARY2048_ADMIN_TOKEN = "ops-admin-token";
    process.env.BINARY2048_RUN_STORE = "memory";
    process.env.BINARY2048_SESSION_STORE = "memory";
    process.env.BINARY2048_REPLAY_ARTIFACT_STORE = "inline";
    resetRunStoreForTests();
    resetSessionStoreForTests();
  });

  afterEach(() => {
    delete process.env.BINARY2048_ADMIN_TOKEN;
    delete process.env.BINARY2048_RUN_STORE;
    delete process.env.BINARY2048_SESSION_STORE;
    delete process.env.BINARY2048_REPLAY_ARTIFACT_STORE;
    resetRunStoreForTests();
    resetSessionStoreForTests();
  });

  it("rejects when admin token is missing", async () => {
    const res = await GET(new Request("http://localhost/api/ops/storage/health"));
    expect(res.status).toBe(401);
  });

  it("writes and loads a smoke run", async () => {
    const req = new Request("http://localhost/api/ops/storage/health", {
      headers: { "x-admin-token": "ops-admin-token" }
    });
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.persisted.replayStorage).toBe("inline");
    expect(json.persisted.hasReplayPayload).toBe(true);
  });
});

