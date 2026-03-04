export type AccessibilityMapInput = {
  replay: boolean;
  showUndo: boolean;
  showOptionsPanel: boolean;
  showActiveExport: boolean;
  showActiveReplay: boolean;
};

function baseRows() {
  return [
    "1. Skip link -> Game controls",
    "2. New Game button",
    "3. Undo button (only when active run)",
    "4. Export/Replay actions for active run"
  ];
}

export function buildAccessibilityTabMap(input: AccessibilityMapInput): string[] {
  const rows = baseRows();
  if (input.replay) {
    rows.push("5. Replay controls (timeline, play/pause, speed, step buttons)");
    rows.push("6. Exit Replay");
    rows.push("7. How to play details and share actions");
    return rows;
  }

  if (input.showOptionsPanel) {
    rows.push("5. Options button");
    rows.push("6. Difficulty, color, theme, mode, import/export controls");
    rows.push("7. How to play details and share actions");
    return rows;
  }

  if (input.showActiveExport || input.showActiveReplay) {
    rows.push("5. How to play details and share actions");
    return rows;
  }

  rows.push("5. How to play details and share actions");
  return rows;
}

export function keyboardShortcutMap(): string[] {
  return [
    "Move: Arrow keys or WASD",
    "Replay: Space toggles play/pause (when replay controls are focused)",
    "Navigation: Tab/Shift+Tab across all controls",
    "Shortcuts are disabled while network actions are in progress"
  ];
}
