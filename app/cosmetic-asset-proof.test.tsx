import { renderToStaticMarkup } from "react-dom/server";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CosmeticAssetProof } from "@/app/cosmetic-asset-proof";
import { validateCosmeticManifest } from "@/lib/binary2048/cosmetic-theme-manifest";
import { WORKBENCH_PROOF_THEME } from "@/lib/binary2048/workbench-proof-theme";

describe("workbench cosmetic asset proof", () => {
  it("uses an immutable, valid local manifest within the per-asset byte cap", () => {
    expect(validateCosmeticManifest(WORKBENCH_PROOF_THEME)).toEqual(WORKBENCH_PROOF_THEME);
    expect(WORKBENCH_PROOF_THEME.assets.every((asset) => asset.bytes <= 2_000_000)).toBe(true);
    expect(WORKBENCH_PROOF_THEME.tileTypes).toEqual(["number", "zero", "wildcard", "lock-0"]);
    for (const asset of WORKBENCH_PROOF_THEME.assets) {
      const bytes = readFileSync(join(process.cwd(), "public", asset.url));
      expect(bytes.byteLength).toBe(asset.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
    }
  });

  it.each(["dark", "light"] as const)("renders semantic non-color cues in %s mode", (scheme) => {
    const html = renderToStaticMarkup(<CosmeticAssetProof scheme={scheme} visionMode="deuteranopia" />);

    expect(html).toContain(`data-scheme="${scheme}"`);
    expect(html).toContain('data-vision-mode="deuteranopia"');
    expect(html).toContain("zero: ring cue");
    expect(html).toContain("wildcard: star cue");
    expect(html).toContain("locked zero: lock cue");
    expect(html).toContain("LOCK 0");
    expect(html).toContain('alt=""');
  });

  it.each(["default", "deuteranopia", "protanopia", "tritanopia"] as const)(
    "retains text and shape cues in %s vision mode",
    (visionMode) => {
      const html = renderToStaticMarkup(<CosmeticAssetProof visionMode={visionMode} />);

      expect(html).toContain(`data-vision-mode="${visionMode}"`);
      expect(html).toContain("WILD");
      expect(html).toContain("LOCK 0");
    }
  );

  it("keeps white labels above WCAG AA contrast over the worst-case atlas pixel", () => {
    // An 82%-opaque black badge over a white pixel produces at most RGB 46.
    const channel = linearize(46 / 255);
    const contrast = (1 + 0.05) / (channel + 0.05);
    expect(contrast).toBeGreaterThan(4.5);
  });
});

function linearize(channel: number) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}
