import {
  BROWSER_ENGINE_PROTOCOL_VERSION,
  BROWSER_ENGINE_RULESET_ID,
  projectBrowserMove
} from "./browser-engine";
import type { Dir, GameEvent, GameState } from "./types";

export type PendingPrediction = {
  id: string;
  direction: Dir;
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
  command: PendingPrediction
): EnqueuedPrediction {
  if (model.pending.some((pending) => pending.id === command.id)) {
    throw new Error(`Duplicate prediction command: ${command.id}`);
  }
  const before = model.predicted;
  const result = predict(before, command.direction);
  return {
    model: {
      acknowledged: model.acknowledged,
      predicted: result.state,
      pending: [...model.pending, command]
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
  let predicted = authoritative;
  for (const command of remaining) {
    predicted = predict(predicted, command.direction).state;
  }
  return { acknowledged: authoritative, predicted, pending: remaining };
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
