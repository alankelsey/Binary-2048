import {
  resolveCosmeticLoadout,
  validateCosmeticManifest,
  type CosmeticPart,
  type CosmeticThemeManifest
} from "@/lib/binary2048/cosmetic-theme-manifest";

const parts: CosmeticPart[] = ["frame", "slots", "surface", "tiles", "icons", "background"];

function manifest(id: string): CosmeticThemeManifest {
  return {
    manifestVersion: 1,
    minimumRendererVersion: 1,
    id,
    revision: "r1",
    label: id,
    assets: parts.map((part) => ({
      id: `${id}.${part}`,
      url: `/themes/${id}/${part}.webp`,
      mime: "image/webp" as const,
      width: 512,
      height: 512,
      bytes: 1024,
      sha256: "a".repeat(64),
      creator: "Binary 2048",
      license: "Apache-2.0"
    })),
    parts: Object.fromEntries(parts.map((part) => [part, `${id}.${part}`])) as Record<CosmeticPart, string>,
    compatibleRulesets: ["binary2048-v1"],
    tileTypes: ["number", "zero", "wildcard", "lock-0"],
    accessibility: {
      textColor: "#ffffff",
      focusColor: "#00ffff",
      nonColorSpecialCues: true,
      reducedMotionAssetIds: []
    }
  };
}

describe("cosmetic theme manifest prototype", () => {
  it("validates version, provenance, assets, tile coverage, and accessibility", () => {
    expect(validateCosmeticManifest(manifest("base"))).toEqual(manifest("base"));
    expect(() => validateCosmeticManifest({ ...manifest("base"), manifestVersion: 2 })).toThrow("version");
    expect(() => validateCosmeticManifest({
      ...manifest("base"),
      tileTypes: ["number", "zero", "wildcard"]
    })).toThrow("every tile type");
    const remote = manifest("remote");
    remote.assets[0].url = "https://unowned.example/frame.webp";
    expect(() => validateCosmeticManifest(remote)).toThrow("origin");
  });

  it("composes mixed owned parts without touching gameplay state", () => {
    const base = manifest("base");
    const jewel = manifest("jewel");
    const loadout = {
      version: 1 as const,
      parts: Object.fromEntries(parts.map((part) => [part, part === "tiles" || part === "icons" ? "jewel" : "base"])) as Record<CosmeticPart, string>
    };
    const plan = resolveCosmeticLoadout({
      loadout,
      manifests: [base, jewel],
      ownedThemeIds: ["jewel"],
      rulesetId: "binary2048-v1",
      baseThemeId: "base"
    });

    expect(plan.fallback).toBe(false);
    expect(plan.layers.find((layer) => layer.part === "tiles")?.themeId).toBe("jewel");
    expect(plan.layers.find((layer) => layer.part === "frame")?.themeId).toBe("base");
    expect(plan).not.toHaveProperty("grid");
    expect(plan).not.toHaveProperty("score");
  });

  it("atomically restores the base theme for unowned or incompatible parts", () => {
    const base = manifest("base");
    const jewel = manifest("jewel");
    const loadout = {
      version: 1 as const,
      parts: Object.fromEntries(parts.map((part) => [part, part === "tiles" ? "jewel" : "base"])) as Record<CosmeticPart, string>
    };
    const plan = resolveCosmeticLoadout({
      loadout,
      manifests: [base, jewel],
      ownedThemeIds: [],
      rulesetId: "binary2048-v1",
      baseThemeId: "base"
    });

    expect(plan.fallback).toBe(true);
    expect(plan.reason).toContain("not owned");
    expect(plan.layers.every((layer) => layer.themeId === "base")).toBe(true);
  });
});
