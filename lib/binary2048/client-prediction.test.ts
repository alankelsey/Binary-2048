import {
  acknowledgeClientPrediction,
  createClientPredictionModel,
  enqueueClientPrediction,
  resetClientPrediction
} from "@/lib/binary2048/client-prediction";
import { applyMove, createGame } from "@/lib/binary2048/engine";

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
      { id: "move-1", direction: "left" },
      { id: "move-2", direction: "down" }
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
    expect(acknowledged.pending).toEqual([{ id: "move-2", direction: "up" }]);
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
});
