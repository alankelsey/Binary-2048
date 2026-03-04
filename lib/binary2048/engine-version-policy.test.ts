import {
  isEngineVersionCompatible,
  normalizeEnginePinMode
} from "@/lib/binary2048/engine-version-policy";

describe("engine-version-policy", () => {
  it("normalizes pin mode with exact default", () => {
    expect(normalizeEnginePinMode(undefined)).toBe("exact");
    expect(normalizeEnginePinMode("minor")).toBe("minor");
    expect(normalizeEnginePinMode("off")).toBe("off");
    expect(normalizeEnginePinMode("weird")).toBe("exact");
  });

  it("supports exact mode compatibility", () => {
    expect(isEngineVersionCompatible("1.2.3", "1.2.3", "exact")).toBe(true);
    expect(isEngineVersionCompatible("1.2.3", "1.2.4", "exact")).toBe(false);
  });

  it("supports minor mode compatibility for semver values", () => {
    expect(isEngineVersionCompatible("1.2.3", "1.2.99", "minor")).toBe(true);
    expect(isEngineVersionCompatible("1.2.3", "1.3.0", "minor")).toBe(false);
  });

  it("falls back to exact for non-semver minor mode values", () => {
    expect(isEngineVersionCompatible("dev", "dev", "minor")).toBe(true);
    expect(isEngineVersionCompatible("dev", "main", "minor")).toBe(false);
  });

  it("supports off mode", () => {
    expect(isEngineVersionCompatible("1.0.0", "2.0.0", "off")).toBe(true);
  });
});

