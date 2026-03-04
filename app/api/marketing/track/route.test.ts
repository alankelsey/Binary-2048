import { POST } from "@/app/api/marketing/track/route";
import { resetMarketingEvents } from "@/lib/binary2048/marketing";

describe("POST /api/marketing/track", () => {
  afterEach(() => {
    resetMarketingEvents();
  });

  it("tracks a share click event", async () => {
    const req = new Request("http://localhost/api/marketing/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "share_click",
        channel: "x",
        referralCode: "b2k-abc123",
        campaign: "launch"
      })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.event?.type).toBe("share_click");
    expect(json.event?.channel).toBe("x");
  });

  it("rejects invalid payload", async () => {
    const req = new Request("http://localhost/api/marketing/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
