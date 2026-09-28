import { POST } from "@/app/api/ops/storage/leaderboard-probe/route";
import { resetLeaderboard } from "@/lib/binary2048/leaderboard";

const probeId = "0123456789abcdef0123456789abcdef";

function request(action: "write" | "read" | "delete", token = "ops-admin-token", id = probeId) {
  return new Request("http://localhost/api/ops/storage/leaderboard-probe", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": token },
    body: JSON.stringify({ action, probeId: id })
  });
}

describe("POST /api/ops/storage/leaderboard-probe", () => {
  beforeEach(async () => {
    process.env.BINARY2048_ADMIN_TOKEN = "ops-admin-token";
    process.env.BINARY2048_LEADERBOARD_STORE = "memory";
    await resetLeaderboard();
  });

  afterEach(async () => {
    delete process.env.BINARY2048_ADMIN_TOKEN;
    delete process.env.BINARY2048_LEADERBOARD_STORE;
    await resetLeaderboard();
  });

  it("rejects missing or incorrect authorization", async () => {
    await expect(POST(request("read", "wrong"))).resolves.toEqual(expect.objectContaining({ status: 401 }));
  });

  it("rejects malformed probe identifiers", async () => {
    await expect(POST(request("read", "ops-admin-token", "../unsafe"))).resolves.toEqual(expect.objectContaining({ status: 400 }));
  });

  it("writes, reads, and deletes an isolated practice entry in separate requests", async () => {
    const written = await POST(request("write"));
    expect(written.status).toBe(200);
    expect(await written.json()).toEqual({ ok: true, action: "write" });

    const read = await POST(request("read"));
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual({ ok: true, action: "read", found: true, count: 1 });

    const deleted = await POST(request("delete"));
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ ok: true, action: "delete", removed: 1 });

    const afterDelete = await POST(request("read"));
    expect(await afterDelete.json()).toEqual({ ok: true, action: "read", found: false, count: 0 });
  });
});
