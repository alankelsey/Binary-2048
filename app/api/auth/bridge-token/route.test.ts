import { POST } from "@/app/api/auth/bridge-token/route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn()
}));

const { getServerSession } = jest.requireMock("next-auth") as {
  getServerSession: jest.Mock;
};

describe("POST /api/auth/bridge-token", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BINARY2048_AUTH_BRIDGE_SECRET;
  });

  it("returns 503 when bridge secret missing", async () => {
    getServerSession.mockResolvedValue({ user: { email: "user@example.com" } });
    const res = await POST(new Request("http://localhost/api/auth/bridge-token", { method: "POST" }));
    expect(res.status).toBe(503);
  });

  it("returns 401 when session missing", async () => {
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = "bridge-secret";
    getServerSession.mockResolvedValue(null);

    const res = await POST(new Request("http://localhost/api/auth/bridge-token", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("mints bridge token from authenticated session", async () => {
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = "bridge-secret";
    getServerSession.mockResolvedValue({
      user: { email: "paid@example.com", name: "paid" },
      tier: "paid",
      entitlements: ["lock_tiles_ranked"]
    });

    const res = await POST(
      new Request("http://localhost/api/auth/bridge-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ttlSeconds: 120 })
      })
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(typeof json.token).toBe("string");
    expect(json.userTier).toBe("paid");
    expect(json.entitlements).toEqual(["lock_tiles_ranked"]);
    expect(json.ttlSeconds).toBe(120);
  });
});
