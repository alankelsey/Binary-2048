import { POST } from "@/app/api/ops/rate-limit/probe/route";
import { checkRateLimit } from "@/lib/binary2048/rate-limit";

jest.mock("@/lib/binary2048/rate-limit", () => ({ checkRateLimit: jest.fn() }));

const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const probeId = "0123456789abcdef0123456789abcdef";

function request(token = "ops-admin-token", apiKey = "b2048_probe-key", id = probeId) {
  return new Request(`http://localhost/api/ops/rate-limit/probe?probeId=${id}`, {
    method: "POST",
    headers: { "x-admin-token": token, "x-api-key": apiKey }
  });
}

describe("POST /api/ops/rate-limit/probe", () => {
  beforeEach(() => {
    process.env.BINARY2048_ADMIN_TOKEN = "ops-admin-token";
    process.env.BINARY2048_RATE_LIMIT_PROBE_HOLD_MS = "0";
    mockCheckRateLimit.mockReset();
  });

  afterEach(() => {
    delete process.env.BINARY2048_ADMIN_TOKEN;
    delete process.env.BINARY2048_RATE_LIMIT_PROBE_HOLD_MS;
  });

  it("rejects incorrect admin authorization before consuming quota", async () => {
    const res = await POST(request("wrong"));
    expect(res.status).toBe(401);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it("rejects malformed probe identifiers before consuming quota", async () => {
    const res = await POST(request("ops-admin-token", "b2048_probe-key", "../unsafe"));
    expect(res.status).toBe(400);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it("requires a validated bot-key identity", async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      key: "redacted",
      limit: 10_000,
      remaining: 9_999,
      retryAfterSeconds: 60,
      resetAtEpochSeconds: 1,
      backend: "memory",
      scope: "ip",
      tier: "guest"
    });
    const res = await POST(request());
    expect(res.status).toBe(401);
  });

  it("fails closed when the shared Mongo counter is unavailable", async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      key: "redacted",
      limit: 10_000,
      remaining: 9_999,
      retryAfterSeconds: 60,
      resetAtEpochSeconds: 1,
      backend: "memory_fallback",
      scope: "api-key",
      tier: null
    });
    const res = await POST(request());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Shared rate-limit store unavailable", backend: "memory_fallback" });
  });

  it("returns only Mongo quota evidence and an opaque stable runtime id", async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      key: "ops_rate_limit_probe:key:secret-id",
      limit: 10_000,
      remaining: 9_998,
      retryAfterSeconds: 60,
      resetAtEpochSeconds: 1_800_000_000,
      backend: "mongo",
      scope: "api-key",
      tier: null
    });

    const first = await POST(request());
    const second = await POST(request());
    const firstJson = await first.json();
    const secondJson = await second.json();

    expect(first.status).toBe(200);
    expect(firstJson).toMatchObject({
      ok: true,
      backend: "mongo",
      scope: "api-key",
      limit: 10_000,
      remaining: 9_998,
      resetAtEpochSeconds: 1_800_000_000
    });
    expect(firstJson.runtimeId).toMatch(/^[a-f0-9]{32}$/);
    expect(secondJson.runtimeId).toBe(firstJson.runtimeId);
    expect(JSON.stringify(firstJson)).not.toContain("secret-id");
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(mockCheckRateLimit).toHaveBeenCalledWith(expect.objectContaining({
      route: `ops_rate_limit_probe_${probeId}`,
      max: 10_000,
      windowMs: 60_000,
      sharedForApiKeysOnly: true
    }));
  });
});
