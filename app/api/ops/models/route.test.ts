import { GET } from "@/app/api/ops/models/route";
import { registerModel, resetModelRegistry } from "@/lib/binary2048/model-registry";

describe("GET /api/ops/models", () => {
  beforeEach(() => {
    process.env.BINARY2048_ADMIN_TOKEN = "ops-test-token";
    resetModelRegistry();
  });

  afterEach(() => {
    delete process.env.BINARY2048_ADMIN_TOKEN;
    resetModelRegistry();
  });

  it("rejects unauthenticated access", async () => {
    expect((await GET(new Request("http://localhost/api/ops/models"))).status).toBe(401);
  });

  it("returns registered models as read-only runtime-scoped data", async () => {
    registerModel({
      modelId: "bot.alpha", family: "bot_policy", version: "v1",
      rulesetId: "binary2048-v1", active: true,
      metadata: { internalToken: "must-not-leak" }
    });
    const res = await GET(new Request("http://localhost/api/ops/models", {
      headers: { "x-admin-token": "ops-test-token" }
    }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.source).toEqual({ scope: "runtime", readOnly: true });
    expect(json.total).toBe(1);
    expect(json.models[0].modelId).toBe("bot.alpha");
    expect(json.models[0].metadata).toBeUndefined();
    expect(JSON.stringify(json)).not.toContain("must-not-leak");
  });
});
