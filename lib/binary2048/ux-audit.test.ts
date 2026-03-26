import { createInitialRageTapState, normalizeAuditControlLabel, recordRageTap } from "@/lib/binary2048/ux-audit";

describe("ux audit helpers", () => {
  it("normalizes control labels for telemetry", () => {
    expect(normalizeAuditControlLabel("Undo 2")).toBe("undo_2");
    expect(normalizeAuditControlLabel(" New Game ")).toBe("new_game");
    expect(normalizeAuditControlLabel("")).toBe("unknown");
  });

  it("flags rage taps when the same control is hit repeatedly in a short window", () => {
    const initial = createInitialRageTapState();
    const first = recordRageTap(initial, "undo", 1000);
    const second = recordRageTap(first.next, "undo", 1500);
    const third = recordRageTap(second.next, "undo", 1900);

    expect(first.shouldTrack).toBe(false);
    expect(second.shouldTrack).toBe(false);
    expect(third.shouldTrack).toBe(true);
  });

  it("resets the rage counter when taps switch control or age out", () => {
    const initial = createInitialRageTapState();
    const first = recordRageTap(initial, "undo", 1000);
    const switched = recordRageTap(first.next, "new_game", 1100);
    const expired = recordRageTap(switched.next, "new_game", 3000);

    expect(switched.next.count).toBe(1);
    expect(switched.shouldTrack).toBe(false);
    expect(expired.next.count).toBe(1);
    expect(expired.shouldTrack).toBe(false);
  });
});
