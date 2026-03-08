import robots from "@/app/robots";

describe("robots", () => {
  it("blocks API crawling and exposes sitemap", () => {
    const config = robots();
    expect(config.sitemap).toBe("https://www.binary2048.com/sitemap.xml");
    expect(config.host).toBe("https://www.binary2048.com");

    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const globalRule = rules.find((rule) => rule.userAgent === "*");
    expect(globalRule).toBeDefined();
    expect(globalRule?.disallow).toEqual(expect.arrayContaining(["/api/"]));
  });
});
