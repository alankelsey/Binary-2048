import { createReferralCode, listMarketingEvents, resetMarketingEvents, trackMarketingEvent } from "@/lib/binary2048/marketing";

describe("marketing hooks", () => {
  afterEach(() => {
    resetMarketingEvents();
  });

  it("creates stable prefixed referral codes", () => {
    expect(createReferralCode(12345678)).toBe("b2k-0007clzi");
  });

  it("tracks and lists marketing events", () => {
    const first = trackMarketingEvent({ type: "share_click", channel: "x", campaign: "launch" });
    const second = trackMarketingEvent({ type: "copy_share", channel: "copy", campaign: "launch" });

    const listed = listMarketingEvents(2);
    expect(listed).toHaveLength(2);
    expect(listed.map((item) => item.id)).toContain(first.id);
    expect(listed.map((item) => item.id)).toContain(second.id);
  });
});
