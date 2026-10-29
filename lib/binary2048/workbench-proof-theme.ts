import type { CosmeticThemeManifest } from "@/lib/binary2048/cosmetic-theme-manifest";

export const WORKBENCH_PROOF_THEME: CosmeticThemeManifest = {
  manifestVersion: 1,
  minimumRendererVersion: 1,
  id: "workbench-proof",
  revision: "v1",
  label: "Workbench proof",
  assets: [
    {
      id: "workbench-board",
      url: "/themes/workbench-proof-v1/board.jpg",
      mime: "image/jpeg",
      width: 1024,
      height: 1024,
      bytes: 348646,
      sha256: "fa8f918e213a5e3f752cf37cc164c2da37cbb37230212c1e09e8bf69c9e3dbb6",
      creator: "OpenAI image generation directed by the Binary 2048 project owner",
      license: "Project proof use and derivatives, subject to applicable OpenAI terms"
    },
    {
      id: "workbench-jewel-atlas",
      url: "/themes/workbench-proof-v1/jewel-tile-atlas.png",
      mime: "image/png",
      width: 768,
      height: 768,
      bytes: 1080310,
      sha256: "a73157db87d0fe3d6aa17388c120b794ee29bdafebfcf1b9ff142c03ed509657",
      creator: "OpenAI image generation directed by the Binary 2048 project owner",
      license: "Project proof use and derivatives, subject to applicable OpenAI terms"
    },
    {
      id: "workbench-background",
      url: "/themes/workbench-proof-v1/page-background.jpg",
      mime: "image/jpeg",
      width: 1600,
      height: 900,
      bytes: 344178,
      sha256: "3ba926cdc14fbbfe36c063907cf06bd1d1dc55d488a457b525f2a317b42838e7",
      creator: "OpenAI image generation directed by the Binary 2048 project owner",
      license: "Project proof use and derivatives, subject to applicable OpenAI terms"
    }
  ],
  parts: {
    frame: "workbench-board",
    slots: "workbench-board",
    surface: "workbench-board",
    tiles: "workbench-jewel-atlas",
    icons: "workbench-jewel-atlas",
    background: "workbench-background"
  },
  compatibleRulesets: ["binary2048-v1", "numbers-only-v1"],
  tileTypes: ["number", "zero", "wildcard", "lock-0"],
  accessibility: {
    textColor: "#ffffff",
    focusColor: "#7dd3fc",
    nonColorSpecialCues: true,
    reducedMotionAssetIds: ["workbench-jewel-atlas"]
  }
};
