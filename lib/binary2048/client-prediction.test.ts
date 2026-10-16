import {
  acknowledgeClientPrediction,
  createClientPredictionModel,
  enqueueClientPrediction,
  reconcileClientPrediction,
  resetClientPrediction
} from "@/lib/binary2048/client-prediction";
import { applyMove, createGame } from "@/lib/binary2048/engine";
import { gameStateHash, STATE_HASH_VERSION } from "@/lib/binary2048/state-identity";

describe("casual client prediction model", () => {
  it("keeps acknowledged, predicted, and pending state separate", () => {
    const initial = createGame({ seed: 20261016 }).state;
    const first = enqueueClientPrediction(createClientPredictionModel(initial), {
      id: "move-1",
      direction: "left"
    });
    const second = enqueueClientPrediction(first.model, { id: "move-2", direction: "down" });

    expect(second.model.acknowledged).toBe(initial);
    expect(second.model.pending).toEqual([
      expect.objectContaining({ id: "move-1", direction: "left" }),
      expect.objectContaining({ id: "move-2", direction: "down" })
    ]);
    expect(second.model.predicted).toEqual(applyMove(first.after, "down").state);
  });

  it("advances acknowledgement and rebases the pending tail exactly once", () => {
    const initial = createGame({ seed: 41 }).state;
    const first = enqueueClientPrediction(createClientPredictionModel(initial), {
      id: "move-1",
      direction: "right"
    });
    const second = enqueueClientPrediction(first.model, { id: "move-2", direction: "up" });
    const authoritative = applyMove(initial, "right").state;
    const acknowledged = acknowledgeClientPrediction(second.model, "move-1", authoritative);

    expect(acknowledged.acknowledged).toBe(authoritative);
    expect(acknowledged.pending).toEqual([
      expect.objectContaining({ id: "move-2", direction: "up" })
    ]);
    expect(acknowledged.predicted).toEqual(applyMove(authoritative, "up").state);
  });

  it("fails closed on duplicate or out-of-order command identities", () => {
    const initial = createGame({ seed: 9 }).state;
    const first = enqueueClientPrediction(createClientPredictionModel(initial), {
      id: "move-1",
      direction: "left"
    });
    expect(() =>
      enqueueClientPrediction(first.model, { id: "move-1", direction: "down" })
    ).toThrow("Duplicate prediction command: move-1");
    expect(() => acknowledgeClientPrediction(first.model, "move-2", first.after)).toThrow(
      "Prediction acknowledgement is out of order: move-2"
    );
  });

  it("rolls every pending command back to the acknowledged snapshot", () => {
    const initial = createGame({ seed: 88 }).state;
    const prediction = enqueueClientPrediction(createClientPredictionModel(initial), {
      id: "move-1",
      direction: "down"
    }).model;
    expect(resetClientPrediction(prediction)).toEqual(createClientPredictionModel(initial));
  });

  it("classifies a matching versioned turn and state hash", () => {
    const initial = createGame({ seed: 101 }).state;
    const prediction = enqueueClientPrediction(createClientPredictionModel(initial), {
      id: "move-1",
      direction: "left"
    });
    const result = reconcileClientPrediction(prediction.model, "move-1", {
      state: prediction.after,
      stateHashVersion: STATE_HASH_VERSION,
      stateHash: gameStateHash(prediction.after)
    });

    expect(result.classification).toBe("match");
    expect(result.model?.acknowledged).toEqual(prediction.after);
    expect(result.model?.pending).toEqual([]);
  });

  it.each([
    {
      classification: "unsupported_hash_version",
      acknowledgement: (expected: ReturnType<typeof enqueueClientPrediction>) => ({
        state: expected.after,
        stateHashVersion: "future-hash",
        stateHash: gameStateHash(expected.after)
      })
    },
    {
      classification: "turn_mismatch",
      acknowledgement: (expected: ReturnType<typeof enqueueClientPrediction>) => {
        const state = { ...expected.after, turn: expected.after.turn + 1 };
        return { state, stateHashVersion: STATE_HASH_VERSION, stateHash: gameStateHash(state) };
      }
    },
    {
      classification: "state_hash_mismatch",
      acknowledgement: (expected: ReturnType<typeof enqueueClientPrediction>) => ({
        state: expected.after,
        stateHashVersion: STATE_HASH_VERSION,
        stateHash: "deadbeef"
      })
    }
  ])("classifies $classification acknowledgements", ({ classification, acknowledgement }) => {
    const initial = createGame({ seed: 102 }).state;
    const prediction = enqueueClientPrediction(createClientPredictionModel(initial), {
      id: "move-1",
      direction: "down"
    });
    expect(
      reconcileClientPrediction(prediction.model, "move-1", acknowledgement(prediction)).classification
    ).toBe(classification);
  });

  it("classifies a response older than the acknowledged turn as stale", () => {
    const created = createGame({ seed: 103 }).state;
    const acknowledged = { ...created, turn: 3 };
    const prediction = enqueueClientPrediction(createClientPredictionModel(acknowledged), {
      id: "move-1",
      direction: "right"
    });
    const stale = { ...prediction.after, turn: 2 };
    const result = reconcileClientPrediction(prediction.model, "move-1", {
      state: stale,
      stateHashVersion: STATE_HASH_VERSION,
      stateHash: gameStateHash(stale)
    });
    expect(result.classification).toBe("stale_response");
  });
});
