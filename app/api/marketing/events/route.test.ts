import { GET } from "@/app/api/marketing/events/route";
import { resetMarketingEvents, trackMarketingEvent } from "@/lib/binary2048/marketing";

describe("GET /api/marketing/events", () => {
  afterEach(() => {
    resetMarketingEvents();
  });

  it("lists tracked marketing events with limit", async () => {
    trackMarketingEvent({ type: "share_click", channel: "x", campaign: "launch" });
    trackMarketingEvent({ type: "copy_share", channel: "copy", campaign: "launch" });

    const req = new Request("http://localhost/api/marketing/events?limit=1");
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.limit).toBe(1);
    expect(Array.isArray(json.events)).toBe(true);
    expect(json.events).toHaveLength(1);
  });
});
