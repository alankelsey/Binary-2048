import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  it("includes core public routes with absolute urls", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain("https://www.binary2048.com/");
    expect(urls).toContain("https://www.binary2048.com/leaderboard");
    expect(urls).toContain("https://www.binary2048.com/store");
    expect(urls).toContain("https://www.binary2048.com/docs");
  });
});
