import type { UIControl, UIPolicy } from "@/lib/binary2048/ui-policy";

export type UIControlOverrides = Partial<Record<UIControl, boolean>>;

export function applyUiPolicyOverrides(base: UIPolicy, overrides: UIControlOverrides): UIPolicy {
  const controls = { ...base.controls };
  for (const key of Object.keys(controls) as UIControl[]) {
    if (typeof overrides[key] === "boolean") {
      controls[key] = Boolean(overrides[key]);
    }
  }
  return {
    ...base,
    controls,
    showOptionsButton: Object.values(controls).some(Boolean)
  };
}
