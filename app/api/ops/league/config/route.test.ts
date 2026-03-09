import { GET, POST } from "@/app/api/ops/league/config/route";
import { getLeagueConfig, resetLeagueConfigForTests } from "@/lib/binary2048/league-config";

describe("league config ops route", () => {
  beforeEach(() => {
    process.env.BINARY2048_ADMIN_TOKEN = "admin-test-token";
    resetLeagueConfigForTests();
  });

  afterEach(() => {
    delete process.env.BINARY2048_ADMIN_TOKEN;
    resetLeagueConfigForTests();
  });

  it("rejects unauthenticated access", async () => {
    const res = await GET(new Request("http://localhost/api/ops/league/config"));
    expect(res.status).toBe(401);
  });

  it("mirrors production config into sandbox", async () => {
    const req = new Request("http://localhost/api/ops/league/config", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-token": "admin-test-token"
      },
      body: JSON.stringify({ action: "mirror" })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.action).toBe("mirror");
    expect(getLeagueConfig("sandbox").seedPoolId).toBe(getLeagueConfig("production").seedPoolId);
  });

  it("promotes sandbox config into production", async () => {
    const mirrorReq = new Request("http://localhost/api/ops/league/config", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-token": "admin-test-token"
      },
      body: JSON.stringify({ action: "mirror" })
    });
    await POST(mirrorReq);
    const promoteReq = new Request("http://localhost/api/ops/league/config", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-token": "admin-test-token"
      },
      body: JSON.stringify({ action: "promote" })
    });
    const res = await POST(promoteReq);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.action).toBe("promote");
    expect(getLeagueConfig("production").seedPoolId).toBe(getLeagueConfig("sandbox").seedPoolId);
  });
});

