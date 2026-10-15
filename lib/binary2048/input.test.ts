import {
  beginSwipeGesture,
  cancelSwipeGesture,
  continueSwipeGesture,
  createSwipeGestureState,
  endSwipeGesture,
  keyToDir,
  swipeToDir,
  type SwipeTouchPoint
} from "@/lib/binary2048/input";

const touch = (identifier: number, clientX = 10, clientY = 10): SwipeTouchPoint => ({
  identifier,
  clientX,
  clientY
});

describe("input mapping", () => {
  it("maps arrow keys and WASD to directions", () => {
    expect(keyToDir("ArrowUp")).toBe("up");
    expect(keyToDir("ArrowDown")).toBe("down");
    expect(keyToDir("ArrowLeft")).toBe("left");
    expect(keyToDir("ArrowRight")).toBe("right");
    expect(keyToDir("w")).toBe("up");
    expect(keyToDir("a")).toBe("left");
    expect(keyToDir("s")).toBe("down");
    expect(keyToDir("d")).toBe("right");
    expect(keyToDir("W")).toBe("up");
    expect(keyToDir("A")).toBe("left");
    expect(keyToDir("S")).toBe("down");
    expect(keyToDir("D")).toBe("right");
    expect(keyToDir("x")).toBeNull();
  });

  it("maps swipe deltas to directions with threshold", () => {
    expect(swipeToDir(30, 4)).toBe("right");
    expect(swipeToDir(-40, 3)).toBe("left");
    expect(swipeToDir(2, 50)).toBe("down");
    expect(swipeToDir(1, -30)).toBe("up");
    expect(swipeToDir(5, 6, 24)).toBeNull();
  });

  it("tracks one finger by identity and clears after a completed or short gesture", () => {
    const tracking = beginSwipeGesture(createSwipeGestureState(), [touch(7)]);
    expect(continueSwipeGesture(tracking, [touch(7, 30, 10)])).toEqual(tracking);
    expect(endSwipeGesture(tracking, [], [touch(7, 50, 12)])).toEqual({
      state: { kind: "idle" },
      delta: { dx: 40, dy: 2 }
    });

    const short = endSwipeGesture(beginSwipeGesture(createSwipeGestureState(), [touch(8)]), [], [touch(8, 15, 14)]);
    expect(short.state).toEqual({ kind: "idle" });
    expect(swipeToDir(short.delta?.dx ?? 0, short.delta?.dy ?? 0, 24)).toBeNull();
  });

  it("blocks mismatched identity and multi-touch until every finger lifts", () => {
    const tracking = beginSwipeGesture(createSwipeGestureState(), [touch(7)]);
    const mismatched = endSwipeGesture(tracking, [touch(7)], [touch(8, 80, 10)]);
    expect(mismatched).toEqual({ state: { kind: "blocked" }, delta: null });
    expect(endSwipeGesture(mismatched.state, [], [touch(7, 90, 10)])).toEqual({
      state: { kind: "idle" },
      delta: null
    });

    const blocked = beginSwipeGesture(createSwipeGestureState(), [touch(9), touch(10)]);
    expect(blocked).toEqual({ kind: "blocked" });
    expect(endSwipeGesture(blocked, [touch(10)], [touch(9)])).toEqual({
      state: { kind: "blocked" },
      delta: null
    });
    expect(endSwipeGesture(blocked, [], [touch(10)])).toEqual({ state: { kind: "idle" }, delta: null });
  });

  it("invalidates tracking when another finger joins or the gesture is cancelled", () => {
    const tracking = beginSwipeGesture(createSwipeGestureState(), [touch(11)]);
    expect(continueSwipeGesture(tracking, [touch(11), touch(12)])).toEqual({ kind: "blocked" });
    expect(beginSwipeGesture(tracking, [touch(11), touch(12)])).toEqual({ kind: "blocked" });
    expect(cancelSwipeGesture([])).toEqual({ kind: "idle" });
    expect(cancelSwipeGesture([touch(11)])).toEqual({ kind: "blocked" });
    expect(endSwipeGesture(tracking, [], [])).toEqual({ state: { kind: "idle" }, delta: null });
  });
});
