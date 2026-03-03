import { getControlVisibility } from "@/lib/binary2048/control-visibility";
import { getUiPolicy } from "@/lib/binary2048/ui-policy";

describe("getControlVisibility", () => {
  const policy = getUiPolicy({}, "production");

  it("shows only active-run controls while a run is active", () => {
    const visibility = getControlVisibility({
      replay: false,
      isPlayable: true,
      isActiveRun: true,
      uiPolicy: policy
    });

    expect(visibility.showUndo).toBe(true);
    expect(visibility.showActiveExport).toBe(true);
    expect(visibility.showActiveReplay).toBe(true);
    expect(visibility.showOptionsPanel).toBe(false);
  });

  it("shows options panel when not in replay and no active run", () => {
    const visibility = getControlVisibility({
      replay: false,
      isPlayable: false,
      isActiveRun: false,
      uiPolicy: policy
    });

    expect(visibility.showUndo).toBe(false);
    expect(visibility.showActiveExport).toBe(false);
    expect(visibility.showActiveReplay).toBe(false);
    expect(visibility.showOptionsPanel).toBe(true);
  });

  it("hides options panel in replay mode", () => {
    const visibility = getControlVisibility({
      replay: true,
      isPlayable: false,
      isActiveRun: false,
      uiPolicy: policy
    });

    expect(visibility.showOptionsPanel).toBe(false);
  });
});
