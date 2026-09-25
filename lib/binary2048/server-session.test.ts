import {
  getOptionalServerSession,
  getRequiredServerSession,
  ServerSessionLookupError
} from "@/lib/binary2048/server-session";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn()
}));

const { getServerSession } = jest.requireMock("next-auth") as {
  getServerSession: jest.Mock;
};

describe("server session lookup", () => {
  const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleWarn.mockRestore();
  });

  it("returns an authenticated session without logging", async () => {
    const session = { user: { email: "user@example.com" } };
    getServerSession.mockResolvedValue(session);

    await expect(getOptionalServerSession("store-page")).resolves.toBe(session);
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it("preserves a confirmed guest result without logging", async () => {
    getServerSession.mockResolvedValue(null);

    await expect(getRequiredServerSession("auth-bridge-token")).resolves.toBeNull();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it("logs PII-free metadata and falls back to guest for read-only surfaces", async () => {
    getServerSession.mockRejectedValue(new Error("cookie=user@example.com"));

    await expect(getOptionalServerSession("privacy-page")).resolves.toBeNull();
    expect(consoleWarn).toHaveBeenCalledWith("Server session lookup failed", {
      event: "server_session_lookup_failed",
      surface: "privacy-page",
      errorName: "Error"
    });
    expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain("user@example.com");
  });

  it("logs and raises a typed error for protected surfaces", async () => {
    getServerSession.mockRejectedValue(new TypeError("sensitive failure detail"));

    await expect(getRequiredServerSession("auth-bridge-token")).rejects.toEqual(
      expect.objectContaining<Partial<ServerSessionLookupError>>({
        name: "ServerSessionLookupError",
        code: "server_session_lookup_failed",
        surface: "auth-bridge-token"
      })
    );
    expect(consoleWarn).toHaveBeenCalledWith("Server session lookup failed", {
      event: "server_session_lookup_failed",
      surface: "auth-bridge-token",
      errorName: "TypeError"
    });
    expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain("sensitive failure detail");
  });
});
