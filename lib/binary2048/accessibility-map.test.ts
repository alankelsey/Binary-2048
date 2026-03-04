import { buildAccessibilityTabMap, keyboardShortcutMap } from "@/lib/binary2048/accessibility-map";

describe("accessibility map", () => {
  it("builds active run tab map", () => {
    const map = buildAccessibilityTabMap({
      replay: false,
      showUndo: true,
      showOptionsPanel: false,
      showActiveExport: true,
      showActiveReplay: true
    });
    expect(map[0]).toContain("Skip link");
    expect(map.join(" ")).toContain("Undo");
    expect(map.join(" ")).toContain("Export/Replay");
  });

  it("builds replay tab map", () => {
    const map = buildAccessibilityTabMap({
      replay: true,
      showUndo: false,
      showOptionsPanel: false,
      showActiveExport: false,
      showActiveReplay: false
    });
    expect(map.join(" ")).toContain("Replay controls");
    expect(map.join(" ")).toContain("Exit Replay");
  });

  it("builds shortcut help lines", () => {
    const lines = keyboardShortcutMap();
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Arrow keys"),
        expect.stringContaining("WASD"),
        expect.stringContaining("Tab/Shift+Tab")
      ])
    );
  });
});
