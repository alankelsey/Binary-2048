import {
  BROWSER_ENGINE_PROTOCOL_VERSION,
  BROWSER_ENGINE_RULESET_ID,
  projectBrowserMove
} from "./browser-engine";
import type { Dir, GameEvent, GameState } from "./types";
import { gameStateHash, STATE_HASH_VERSION } from "./state-identity";

export type PendingPrediction = {
  id: string;
  direction: Dir;
  expectedTurn: number;
  expectedStateHash: string;
};

export type PredictionCommand = Pick<PendingPrediction, "id" | "direction">;

export type ReconciliationClassification =
  | "match"
  | "turn_mismatch"
  | "state_hash_mismatch"
  | "stale_response"
  | "unsupported_hash_version";

export type PredictionAcknowledgement = {
  state: GameState;
  stateHashVersion: unknown;
  stateHash: unknown;
};

export type PredictionReconciliation = {
  classification: ReconciliationClassification;
  expectedTurn: number;
  actualTurn: number;
  expectedStateHash: string;
  actualStateHash: string | null;
  model?: ClientPredictionModel;
};

export type ClientPredictionModel = {
  acknowledged: GameState;
  predicted: GameState;
  pending: PendingPrediction[];
};

export type EnqueuedPrediction = {
  model: ClientPredictionModel;
  before: GameState;
  after: GameState;
  moved: boolean;
  events: GameEvent[];
};

export function createClientPredictionModel(acknowledged: GameState): ClientPredictionModel {
  return {
    acknowledged,
    predicted: acknowledged,
    pending: []
  };
}

export function enqueueClientPrediction(
  model: ClientPredictionModel,
  command: PredictionCommand
): EnqueuedPrediction {
  if (model.pending.some((pending) => pending.id === command.id)) {
    throw new Error(`Duplicate prediction command: ${command.id}`);
  }
  const before = model.predicted;
  const result = predict(before, command.direction);
  const pending = expectedCommand(command, result.state);
  return {
    model: {
      acknowledged: model.acknowledged,
      predicted: result.state,
      pending: [...model.pending, pending]
    },
    before,
    after: result.state,
    moved: result.moved,
    events: result.events
  };
}

export function acknowledgeClientPrediction(
  model: ClientPredictionModel,
  commandId: string,
  authoritative: GameState
): ClientPredictionModel {
  const active = model.pending[0];
  if (!active || active.id !== commandId) {
    throw new Error(`Prediction acknowledgement is out of order: ${commandId}`);
  }

  const remaining = model.pending.slice(1);
  return rebase(authoritative, remaining);
}

export function reconcileClientPrediction(
  model: ClientPredictionModel,
  commandId: string,
  acknowledgement: PredictionAcknowledgement
): PredictionReconciliation {
  const active = model.pending[0];
  if (!active || active.id !== commandId) {
    throw new Error(`Prediction acknowledgement is out of order: ${commandId}`);
  }
  const actualHash = typeof acknowledgement.stateHash === "string" ? acknowledgement.stateHash : null;
  const result = {
    expectedTurn: active.expectedTurn,
    actualTurn: acknowledgement.state.turn,
    expectedStateHash: active.expectedStateHash,
    actualStateHash: actualHash
  };

  if (acknowledgement.stateHashVersion !== STATE_HASH_VERSION) {
    return { classification: "unsupported_hash_version", ...result };
  }
  if (acknowledgement.state.turn < model.acknowledged.turn) {
    return { classification: "stale_response", ...result };
  }
  if (acknowledgement.state.turn !== active.expectedTurn) {
    return { classification: "turn_mismatch", ...result };
  }
  if (
    actualHash !== active.expectedStateHash ||
    actualHash !== gameStateHash(acknowledgement.state)
  ) {
    return { classification: "state_hash_mismatch", ...result };
  }

  return {
    classification: "match",
    ...result,
    model: rebase(acknowledgement.state, model.pending.slice(1))
  };
}

export function resetClientPrediction(
  model: ClientPredictionModel,
  acknowledged: GameState = model.acknowledged
): ClientPredictionModel {
  return createClientPredictionModel(acknowledged);
}

function predict(state: GameState, direction: Dir) {
  return projectBrowserMove({
    protocolVersion: BROWSER_ENGINE_PROTOCOL_VERSION,
    rulesetId: BROWSER_ENGINE_RULESET_ID,
    state,
    direction
  });
}

function expectedCommand(command: PredictionCommand, state: GameState): PendingPrediction {
  return {
    ...command,
    expectedTurn: state.turn,
    expectedStateHash: gameStateHash(state)
  };
}

function rebase(acknowledged: GameState, commands: PendingPrediction[]): ClientPredictionModel {
  let predicted = acknowledged;
  const pending = commands.map((command) => {
    predicted = predict(predicted, command.direction).state;
    return expectedCommand(command, predicted);
  });
  return { acknowledged, predicted, pending };
}
