import { applyMove } from "./engine";
import type { Dir, GameEvent, GameState } from "./types";

export const BROWSER_ENGINE_PROTOCOL_VERSION = 1 as const;
export const BROWSER_ENGINE_RULESET_ID = "binary2048-v1" as const;

export type BrowserMoveInput = {
  protocolVersion: typeof BROWSER_ENGINE_PROTOCOL_VERSION;
  rulesetId: typeof BROWSER_ENGINE_RULESET_ID;
  state: GameState;
  direction: Dir;
};

export type BrowserMoveResult = {
  protocolVersion: typeof BROWSER_ENGINE_PROTOCOL_VERSION;
  rulesetId: typeof BROWSER_ENGINE_RULESET_ID;
  direction: Dir;
  baseTurn: number;
  state: GameState;
  moved: boolean;
  events: GameEvent[];
};

/**
 * Runs the canonical engine through a narrow browser boundary. The adapter
 * owns version checks and reference isolation; all game rules remain in
 * applyMove.
 */
export function projectBrowserMove(input: BrowserMoveInput): BrowserMoveResult {
  if (input.protocolVersion !== BROWSER_ENGINE_PROTOCOL_VERSION) {
    throw new Error(`Unsupported browser engine protocol: ${input.protocolVersion}`);
  }
  if (input.rulesetId !== BROWSER_ENGINE_RULESET_ID) {
    throw new Error(`Unsupported browser engine ruleset: ${input.rulesetId}`);
  }

  const isolatedState = cloneTransportState(input.state);
  const result = applyMove(isolatedState, input.direction);

  return {
    protocolVersion: BROWSER_ENGINE_PROTOCOL_VERSION,
    rulesetId: BROWSER_ENGINE_RULESET_ID,
    direction: input.direction,
    baseTurn: input.state.turn,
    state: cloneTransportState(result.state),
    moved: result.moved,
    events: result.events.map((event) => ({ ...event }))
  };
}

function cloneTransportState(state: GameState): GameState {
  return {
    ...state,
    config: {
      ...state.config,
      spawn: {
        ...state.config.spawn,
        wildcardMultipliers: [...state.config.spawn.wildcardMultipliers]
      }
    },
    grid: state.grid.map((row) => row.map((cell) => (cell ? { ...cell } : null)))
  };
}
