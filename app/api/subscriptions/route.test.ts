import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import { DELETE, GET, POST } from "@/app/api/subscriptions/route";

describe("api subscriptions", () => {
  afterEach(() => {
    delete process.env.BINARY2048_AUTH_BRIDGE_SECRET;
  });

  it("validates missing subscriberId on GET", async () => {
    const res = await GET(new Request("http://localhost/api/subscriptions"));
    expect(res.status).toBe(400);
  });

  it("creates and lists subscriptions", async () => {
    const createRes = await POST(
      new Request("http://localhost/api/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscriberId: "user-sub-api",
          transport: "email",
          endpoint: "user-sub-api@example.com",
          topics: ["app_updates"]
        })
      })
    );
    const created = await createRes.json();
    expect(createRes.status).toBe(200);
    expect(created.subscription?.id).toMatch(/^sub_/);

    const listRes = await GET(
      new Request("http://localhost/api/subscriptions?subscriberId=user-sub-api")
    );
    const listed = await listRes.json();
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listed.subscriptions)).toBe(true);
    expect(listed.subscriptions.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects invalid POST payload", async () => {
    const res = await POST(
      new Request("http://localhost/api/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscriberId: "u",
          transport: "email",
          endpoint: "",
          topics: []
        })
      })
    );
    expect(res.status).toBe(400);
  });

  it("enforces guest topic restrictions", async () => {
    const res = await POST(
      new Request("http://localhost/api/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscriberId: "guest-user",
          transport: "email",
          endpoint: "guest-user@example.com",
          topics: ["player_actions"]
        })
      })
    );
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.userTier).toBe("guest");
    expect(json.deniedTopics).toEqual(["player_actions"]);
  });

  it("allows authed topic set when auth bridge token is valid", async () => {
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = "subscriptions-auth-secret";
    const token = createAuthBridgeToken(
      {
        sub: "authed-user",
        exp: Math.floor(Date.now() / 1000) + 60,
        tier: "authed"
      },
      process.env.BINARY2048_AUTH_BRIDGE_SECRET
    );
    const res = await POST(
      new Request("http://localhost/api/subscriptions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          subscriberId: "authed-user",
          transport: "inapp",
          endpoint: "authed-user",
          topics: ["player_actions"]
        })
      })
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.userTier).toBe("authed");
    expect(json.subscription?.topics).toEqual(["player_actions"]);
  });

  it("deletes subscriptions by id", async () => {
    const createRes = await POST(
      new Request("http://localhost/api/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscriberId: "user-delete",
          transport: "inapp",
          endpoint: "user-delete",
          topics: ["app_updates"]
        })
      })
    );
    const created = await createRes.json();
    const id = created.subscription?.id as string;
    const deleteRes = await DELETE(new Request(`http://localhost/api/subscriptions?id=${encodeURIComponent(id)}`));
    const deleted = await deleteRes.json();
    expect(deleteRes.status).toBe(200);
    expect(deleted.deleted).toBe(true);

    const deleteMissing = await DELETE(new Request("http://localhost/api/subscriptions?id=missing_sub"));
    expect(deleteMissing.status).toBe(404);
  });
});
