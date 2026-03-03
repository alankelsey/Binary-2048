import type { UIPolicy } from "@/lib/binary2048/ui-policy";

export type ControlVisibilityInput = {
  replay: boolean;
  isPlayable: boolean;
  isActiveRun: boolean;
  uiPolicy: UIPolicy;
};

export type ControlVisibility = {
  showUndo: boolean;
  showActiveExport: boolean;
  showActiveReplay: boolean;
  showOptionsPanel: boolean;
};

export function getControlVisibility(input: ControlVisibilityInput): ControlVisibility {
  const { replay, isPlayable, isActiveRun, uiPolicy } = input;
  return {
    showUndo: isPlayable,
    showActiveExport: isActiveRun,
    showActiveReplay: isActiveRun,
    showOptionsPanel: !isActiveRun && !replay && uiPolicy.showOptionsButton
  };
}
