export const ACTION_PRIORITY = ["U", "L", "R", "D"];

export function formatEncodedBoard(encodedState) {
  if (!Array.isArray(encodedState)) throw new Error("encodedState must be an array");
  return encodedState.map((row) => {
    if (!Array.isArray(row)) throw new Error("encodedState rows must be arrays");
    return row.map((cell) => {
      if (!cell || typeof cell !== "object") return "?";
      if (cell.type === 0) return ".";
      if (cell.type === 1) return "Z";
      if (cell.type === 2) return String(2 ** Number(cell.value ?? 0));
      if (cell.type === 3) return `W${2 ** Number(cell.value ?? 0)}`;
      if (cell.type === 4) return "L0";
      return "?";
    });
  });
}

export function parseOllamaAction(content, legalActions) {
  if (!Array.isArray(legalActions) || legalActions.length === 0) return null;
  try {
    const parsed = JSON.parse(content);
    const action = typeof parsed?.action === "string" ? parsed.action.toUpperCase() : "";
    if (legalActions.includes(action)) return { action, fallback: false };
  } catch {
    // Fall through to a deterministic legal action.
  }
  const fallback = ACTION_PRIORITY.find((action) => legalActions.includes(action)) ?? legalActions[0];
  return fallback ? { action: fallback, fallback: true } : null;
}

export function buildMovePrompt(encodedState, legalActions) {
  const board = formatEncodedBoard(encodedState);
  return [
    "Choose the strongest legal Binary 2048 move.",
    "Rows are shown top to bottom. Cells: . empty, Z zero, L0 locked zero, Wn wildcard multiplier, numbers are tiles.",
    "Prefer merges, empty cells, monotonic high tiles near a corner, and avoiding terminal positions.",
    `Board: ${JSON.stringify(board)}`,
    `Legal actions: ${JSON.stringify(legalActions)}`,
    "Return only the required JSON action."
  ].join("\n");
}

