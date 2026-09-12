describe("GitHub authentication configuration", () => {
  const originalId = process.env.AUTH_GITHUB_ID;
  const originalSecret = process.env.AUTH_GITHUB_SECRET;

  afterEach(() => {
    jest.resetModules();
    if (originalId === undefined) delete process.env.AUTH_GITHUB_ID;
    else process.env.AUTH_GITHUB_ID = originalId;
    if (originalSecret === undefined) delete process.env.AUTH_GITHUB_SECRET;
    else process.env.AUTH_GITHUB_SECRET = originalSecret;
  });

  it("configures the issuer GitHub sends in OAuth callbacks", async () => {
    process.env.AUTH_GITHUB_ID = "test-client-id";
    process.env.AUTH_GITHUB_SECRET = "test-client-secret";
    jest.resetModules();

    const { authOptions, GITHUB_OAUTH_ISSUER } = await import("@/auth");
    const github = authOptions.providers.find((provider) => provider.id === "github");

    expect(GITHUB_OAUTH_ISSUER).toBe("https://github.com/login/oauth");
    expect(github).toMatchObject({ options: { issuer: GITHUB_OAUTH_ISSUER } });
  });
});
