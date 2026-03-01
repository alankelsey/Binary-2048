import { getUiPolicy } from "@/lib/binary2048/ui-policy";

describe("ui policy", () => {
  it("keeps all controls enabled in dev by default", () => {
    const policy = getUiPolicy({}, "development");
    expect(policy.controls.difficulty).toBe(true);
    expect(policy.controls.color).toBe(true);
    expect(policy.controls.mode).toBe(true);
    expect(policy.controls.import).toBe(true);
    expect(policy.controls.export).toBe(true);
  });

  it("supports production disabled controls list", () => {
    const policy = getUiPolicy(
      {
        NEXT_PUBLIC_UI_DISABLED_CONTROLS: "export,mode"
      },
      "production"
    );
    expect(policy.controls.export).toBe(false);
    expect(policy.controls.mode).toBe(false);
    expect(policy.controls.import).toBe(true);
  });

  it("allows admin mode to enforce disabled controls even in dev", () => {
    const policy = getUiPolicy(
      {
        NEXT_PUBLIC_UI_DISABLED_CONTROLS: "difficulty",
        NEXT_PUBLIC_UI_ADMIN_MODE: "1"
      },
      "development"
    );
    expect(policy.controls.difficulty).toBe(false);
  });
});
