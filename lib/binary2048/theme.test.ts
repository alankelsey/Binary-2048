import { isThemeMode, THEMES } from "@/lib/binary2048/theme";

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
});
