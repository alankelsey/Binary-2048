import { buildShareLandingUrl, buildShareText, buildShareUrls } from "@/lib/binary2048/share";

describe("share helpers", () => {
  it("builds stable share text", () => {
    expect(buildShareText(128, 512, 34)).toContain("I scored 128");
    expect(buildShareText(128, 512, 34)).toContain("high 512");
    expect(buildShareText(128, 512, 34)).toContain("moves 34");
  });

  it("builds encoded share urls", () => {
    const urls = buildShareUrls("hello world", "https://binary2048.com");
    expect(urls.x).toContain("x.com/intent/tweet");
    expect(urls.x).toContain("hello%20world");
    expect(urls.linkedin).toContain("linkedin.com");
    expect(urls.linkedin).toContain("https%3A%2F%2Fbinary2048.com");
  });

  it("builds referral-aware share landing urls", () => {
    const url = buildShareLandingUrl("https://binary2048.com", {
      referralCode: "b2k-abc123",
      campaign: "launch",
      source: "app",
      medium: "social"
    });
    expect(url).toContain("ref=b2k-abc123");
    expect(url).toContain("utm_campaign=launch");
    expect(url).toContain("utm_source=app");
    expect(url).toContain("utm_medium=social");
  });
});
