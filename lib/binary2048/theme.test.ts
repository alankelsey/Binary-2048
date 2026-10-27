import {
  BOARD_BACKGROUNDS,
  isBoardBackground,
  isCssHexColor,
  isThemeMode,
  isTileStyle,
  readableTextColor,
  THEMES,
  TILE_COLOR_PRESETS,
  TILE_STYLES
} from "@/lib/binary2048/theme";

describe("theme helpers", () => {
  it("exposes the expected theme key set and order", () => {
    expect(Object.keys(THEMES)).toEqual(["classic", "midnight", "aurora", "ember", "light"]);
  });

  it("keeps Original as the first/default theme option", () => {
    const entries = Object.entries(THEMES);
    expect(entries[0]?.[0]).toBe("classic");
    expect(entries[0]?.[1].label).toBe("Original");
  });

  it("keeps stable theme labels", () => {
    expect(THEMES.classic.label).toBe("Original");
    expect(THEMES.midnight.label).toBe("Deep Midnight");
    expect(THEMES.aurora.label).toBe("Aurora");
    expect(THEMES.ember.label).toBe("Ember");
    expect(THEMES.light.label).toBe("Light");
  });

  it("supports all declared themes", () => {
    for (const key of Object.keys(THEMES)) {
      expect(isThemeMode(key)).toBe(true);
    }
  });

  it("rejects unknown theme values", () => {
    expect(isThemeMode("")).toBe(false);
    expect(isThemeMode("default")).toBe(false);
    expect(isThemeMode("banana")).toBe(false);
    expect(isThemeMode(null)).toBe(false);
  });

  it("exposes independent background and tile-style choices", () => {
    expect(BOARD_BACKGROUNDS).toEqual({
      default: { label: "Default" },
      cherryBlossom: { label: "Cherry Blossom" }
    });
    expect(TILE_STYLES).toEqual({
      normal: { label: "Normal" },
      translucent40: { label: "40% opacity" },
      opaque: { label: "Opaque" }
    });
    expect(TILE_COLOR_PRESETS.blossom).toEqual({ label: "Blossom Pink", color: "#f5b7c5" });
    expect(isBoardBackground("cherryBlossom")).toBe(true);
    expect(isBoardBackground("flowers")).toBe(false);
    expect(isTileStyle("translucent40")).toBe(true);
    expect(isTileStyle("opaque")).toBe(true);
    expect(isTileStyle("glass")).toBe(false);
  });

  it("validates picker colors and derives readable opaque-tile text", () => {
    expect(isCssHexColor("#fefefe")).toBe(true);
    expect(isCssHexColor("red")).toBe(false);
    expect(readableTextColor("#fffdf8")).toBe("#241719");
    expect(readableTextColor("#241719")).toBe("#fffdf8");
  });
});
