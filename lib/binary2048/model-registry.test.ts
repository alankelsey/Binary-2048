import {
  enforceModelPin,
  listRegisteredModels,
  registerModel,
  resetModelRegistry,
  resolveModelVersion
} from "@/lib/binary2048/model-registry";

describe("model registry", () => {
  beforeEach(() => {
    resetModelRegistry();
  });

  it("resolves explicit model versions", () => {
    registerModel({
      modelId: "bot.alpha",
      family: "bot_policy",
      version: "v1",
      rulesetId: "binary2048-v1",
      active: true
    });

    const model = resolveModelVersion("bot.alpha", "v1");
    expect(model?.version).toBe("v1");
  });

  it("resolves newest active model by default", () => {
    registerModel({
      modelId: "bot.alpha",
      family: "bot_policy",
      version: "v1",
      rulesetId: "binary2048-v1",
      active: true,
      createdAtISO: "2026-03-01T00:00:00.000Z"
    });
    registerModel({
      modelId: "bot.alpha",
      family: "bot_policy",
      version: "v2",
      rulesetId: "binary2048-v1",
      active: true,
      createdAtISO: "2026-03-02T00:00:00.000Z"
    });

    const resolved = resolveModelVersion("bot.alpha");
    expect(resolved?.version).toBe("v2");
  });

  it("throws when a pinned model is missing", () => {
    expect(() => enforceModelPin("bot.alpha", "v3")).toThrow(/Pinned model not found/);
  });

  it("lists defensive copies in stable order", () => {
    registerModel({
      modelId: "bot.beta", family: "bot_policy", version: "v1",
      rulesetId: "binary2048-v1", active: false,
      createdAtISO: "2026-03-01T00:00:00.000Z", metadata: { source: "test" }
    });
    registerModel({
      modelId: "bot.alpha", family: "bot_policy", version: "v2",
      rulesetId: "binary2048-v1", active: true,
      createdAtISO: "2026-03-02T00:00:00.000Z"
    });

    const records = listRegisteredModels();
    expect(records.map((record) => record.modelId)).toEqual(["bot.alpha", "bot.beta"]);
    records[1].metadata!.source = "changed";
    expect(resolveModelVersion("bot.beta", "v1")?.metadata?.source).toBe("test");
  });
});
