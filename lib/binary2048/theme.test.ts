import { isThemeMode, THEMES } from "@/lib/binary2048/theme";

describe("theme helpers", () => {
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
