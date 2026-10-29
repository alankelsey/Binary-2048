export const COSMETIC_MANIFEST_VERSION = 1 as const;
export const COSMETIC_RENDERER_VERSION = 1 as const;

export type CosmeticPart = "frame" | "slots" | "surface" | "tiles" | "icons" | "background";
export type CosmeticTileType = "number" | "zero" | "wildcard" | "lock-0";

export type CosmeticAsset = {
  id: string;
  url: string;
  mime: "image/avif" | "image/webp" | "image/png" | "image/jpeg" | "image/svg+xml";
  width: number;
  height: number;
  bytes: number;
  sha256: string;
  creator: string;
  license: string;
  fallbackAssetId?: string;
};

export type CosmeticThemeManifest = {
  manifestVersion: typeof COSMETIC_MANIFEST_VERSION;
  minimumRendererVersion: number;
  id: string;
  revision: string;
  label: string;
  assets: CosmeticAsset[];
  parts: Record<CosmeticPart, string>;
  compatibleRulesets: string[];
  tileTypes: CosmeticTileType[];
  accessibility: {
    textColor: string;
    focusColor: string;
    nonColorSpecialCues: boolean;
    reducedMotionAssetIds: string[];
  };
};

export type CosmeticLoadout = {
  version: 1;
  parts: Record<CosmeticPart, string>;
};

export type CosmeticRenderPlan = {
  rendererVersion: typeof COSMETIC_RENDERER_VERSION;
  fallback: boolean;
  reason?: string;
  layers: Array<{ part: CosmeticPart; themeId: string; asset: CosmeticAsset }>;
  accessibility: CosmeticThemeManifest["accessibility"];
};

const PARTS: CosmeticPart[] = ["background", "surface", "frame", "slots", "tiles", "icons"];
const TILE_TYPES: CosmeticTileType[] = ["number", "zero", "wildcard", "lock-0"];
const SAFE_MIMES = new Set(["image/avif", "image/webp", "image/png", "image/jpeg", "image/svg+xml"]);
const ID = /^[a-z0-9][a-z0-9._-]{1,79}$/;
const HASH = /^[a-f0-9]{64}$/;
const COLOR = /^#[a-f0-9]{6}$/i;

export function validateCosmeticManifest(
  value: unknown,
  options: { ownedOrigins?: string[] } = {}
): CosmeticThemeManifest {
  if (!value || typeof value !== "object") throw new Error("Cosmetic manifest must be an object");
  const manifest = structuredClone(value) as CosmeticThemeManifest;
  if (manifest.manifestVersion !== COSMETIC_MANIFEST_VERSION) throw new Error("Unsupported cosmetic manifest version");
  if (!Number.isInteger(manifest.minimumRendererVersion) || manifest.minimumRendererVersion > COSMETIC_RENDERER_VERSION) {
    throw new Error("Cosmetic manifest requires an unsupported renderer");
  }
  if (!ID.test(manifest.id) || !ID.test(manifest.revision) || !manifest.label?.trim()) throw new Error("Cosmetic identity is invalid");
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) throw new Error("Cosmetic assets are required");
  const assets = new Map<string, CosmeticAsset>();
  for (const asset of manifest.assets) {
    if (!ID.test(asset.id) || assets.has(asset.id)) throw new Error("Cosmetic asset IDs must be valid and unique");
    if (!SAFE_MIMES.has(asset.mime) || !Number.isSafeInteger(asset.width) || asset.width < 1 || asset.width > 4096 ||
        !Number.isSafeInteger(asset.height) || asset.height < 1 || asset.height > 4096 ||
        !Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || asset.bytes > 2_000_000 || !HASH.test(asset.sha256)) {
      throw new Error("Cosmetic asset metadata is invalid");
    }
    if (!asset.creator.trim() || !asset.license.trim() || !isOwnedUrl(asset.url, options.ownedOrigins ?? [])) {
      throw new Error("Cosmetic asset provenance or origin is invalid");
    }
    assets.set(asset.id, asset);
  }
  for (const part of PARTS) if (!assets.has(manifest.parts?.[part])) throw new Error(`Cosmetic ${part} asset is missing`);
  for (const asset of manifest.assets) {
    if (asset.fallbackAssetId && !assets.has(asset.fallbackAssetId)) throw new Error("Cosmetic fallback asset is missing");
  }
  if (!Array.isArray(manifest.compatibleRulesets) || manifest.compatibleRulesets.length === 0 ||
      !manifest.compatibleRulesets.every((id) => typeof id === "string" && ID.test(id))) {
    throw new Error("Cosmetic ruleset compatibility is invalid");
  }
  if (!Array.isArray(manifest.tileTypes) || !TILE_TYPES.every((type) => manifest.tileTypes.includes(type))) {
    throw new Error("Cosmetic manifest must support every tile type");
  }
  if (!COLOR.test(manifest.accessibility?.textColor) || !COLOR.test(manifest.accessibility?.focusColor) ||
      manifest.accessibility.nonColorSpecialCues !== true ||
      !Array.isArray(manifest.accessibility.reducedMotionAssetIds) ||
      !manifest.accessibility.reducedMotionAssetIds.every((id) => assets.has(id))) {
    throw new Error("Cosmetic accessibility metadata is invalid");
  }
  return manifest;
}

export function resolveCosmeticLoadout(input: {
  loadout: CosmeticLoadout;
  manifests: CosmeticThemeManifest[];
  ownedThemeIds: string[];
  rulesetId: string;
  baseThemeId: string;
  ownedOrigins?: string[];
}): CosmeticRenderPlan {
  try {
    const manifests = new Map(input.manifests.map((value) => {
      const manifest = validateCosmeticManifest(value, { ownedOrigins: input.ownedOrigins });
      return [manifest.id, manifest] as const;
    }));
    const base = manifests.get(input.baseThemeId);
    if (!base) throw new Error("Base cosmetic theme is missing");
    const owned = new Set([input.baseThemeId, ...input.ownedThemeIds]);
    const layers = PARTS.map((part) => {
      const themeId = input.loadout.parts?.[part];
      const manifest = manifests.get(themeId);
      if (!manifest || !owned.has(themeId)) throw new Error(`Cosmetic ${part} is not owned`);
      if (!manifest.compatibleRulesets.includes(input.rulesetId)) throw new Error(`Cosmetic ${part} is incompatible`);
      const asset = manifest.assets.find((candidate) => candidate.id === manifest.parts[part]);
      if (!asset) throw new Error(`Cosmetic ${part} asset is unavailable`);
      return { part, themeId, asset };
    });
    return { rendererVersion: COSMETIC_RENDERER_VERSION, fallback: false, layers, accessibility: base.accessibility };
  } catch (error) {
    const base = validateCosmeticManifest(input.manifests.find((manifest) => manifest.id === input.baseThemeId), {
      ownedOrigins: input.ownedOrigins
    });
    return {
      rendererVersion: COSMETIC_RENDERER_VERSION,
      fallback: true,
      reason: error instanceof Error ? error.message : "Cosmetic loadout failed",
      layers: PARTS.map((part) => ({
        part,
        themeId: base.id,
        asset: base.assets.find((asset) => asset.id === base.parts[part])!
      })),
      accessibility: base.accessibility
    };
  }
}

function isOwnedUrl(value: string, origins: string[]) {
  if (value.startsWith("/themes/") && !value.includes("..")) return true;
  try {
    return origins.includes(new URL(value).origin);
  } catch {
    return false;
  }
}
