import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import { getAdminAuthority, isAdminRequest, isAdminSubject } from "@/lib/binary2048/admin-auth";

function bearer(subject: string, tier: "guest" | "authed" | "paid" = "authed", expOffsetSeconds = 60) {
  const token = createAuthBridgeToken(
    { sub: subject, tier, exp: Math.floor(Date.now() / 1000) + expOffsetSeconds },
    process.env.BINARY2048_AUTH_BRIDGE_SECRET ?? ""
  );
  return new Request("http://localhost/api/ops/example", { headers: { authorization: `Bearer ${token}` } });
}

describe("server-verified admin authority", () => {
  beforeEach(() => {
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = "admin-auth-bridge-secret";
    process.env.BINARY2048_ADMIN_TOKEN = "admin-service-token";
    process.env.BINARY2048_ADMIN_SUBJECTS = "admin@example.com,\nsecond-admin@example.com";
    process.env.NEXT_PUBLIC_UI_ADMIN_MODE = "1";
  });

  afterEach(() => {
    delete process.env.BINARY2048_AUTH_BRIDGE_SECRET;
    delete process.env.BINARY2048_ADMIN_TOKEN;
    delete process.env.BINARY2048_ADMIN_SUBJECTS;
    delete process.env.NEXT_PUBLIC_UI_ADMIN_MODE;
  });

  it("accepts the configured service token without exposing it as a user role", () => {
    const req = new Request("http://localhost/api/ops/example", { headers: { "x-admin-token": "admin-service-token" } });
    expect(getAdminAuthority(req)).toEqual({ kind: "service-token" });
    expect(isAdminRequest(req)).toBe(true);
    expect(isAdminRequest(new Request("http://localhost", { headers: { "x-admin-token": "wrong" } }))).toBe(false);
  });

  it("accepts only verified bearer subjects in the explicit allowlist", () => {
    expect(getAdminAuthority(bearer("admin@example.com"))).toEqual({ kind: "subject-allowlist", subject: "admin@example.com" });
    expect(getAdminAuthority(bearer("second-admin@example.com"))).toEqual({ kind: "subject-allowlist", subject: "second-admin@example.com" });
    expect(isAdminSubject("admin@example.com")).toBe(true);
    expect(isAdminSubject("ADMIN@example.com")).toBe(false);
  });

  it("does not grant admin authority from account tier, entitlement, or public UI configuration", () => {
    expect(isAdminRequest(bearer("paid@example.com", "paid"))).toBe(false);
    expect(isAdminRequest(new Request("http://localhost", { headers: { "x-admin-subject": "admin@example.com" } }))).toBe(false);
  });

  it("fails closed for expired credentials and missing server configuration", () => {
    expect(isAdminRequest(bearer("admin@example.com", "authed", -60))).toBe(false);
    delete process.env.BINARY2048_ADMIN_TOKEN;
    delete process.env.BINARY2048_ADMIN_SUBJECTS;
    expect(isAdminRequest(new Request("http://localhost", { headers: { "x-admin-token": "admin-service-token" } }))).toBe(false);
    expect(isAdminRequest(bearer("admin@example.com"))).toBe(false);
  });
});
