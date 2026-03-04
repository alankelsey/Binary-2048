import { getUiPolicy } from "@/lib/binary2048/ui-policy";
import { applyUiPolicyOverrides } from "@/lib/binary2048/ui-policy-override";

describe("ui policy override", () => {
  it("applies explicit runtime control overrides", () => {
    const base = getUiPolicy({}, "development");
    const effective = applyUiPolicyOverrides(base, {
      difficulty: false,
      export: false
    });
    expect(effective.controls.difficulty).toBe(false);
    expect(effective.controls.export).toBe(false);
    expect(effective.controls.color).toBe(true);
  });

  it("updates showOptionsButton when all controls are disabled", () => {
    const base = getUiPolicy({}, "development");
    const effective = applyUiPolicyOverrides(base, {
      difficulty: false,
      color: false,
      mode: false,
      import: false,
      export: false
    });
    expect(effective.showOptionsButton).toBe(false);
  });
});
