import type { Dir } from "@/lib/binary2048/types";

export type SwipeTouchPoint = {
  identifier: number;
  clientX: number;
  clientY: number;
};

export type SwipeGestureState =
  | { kind: "idle" }
  | { kind: "tracking"; identifier: number; x: number; y: number }
  | { kind: "blocked" };

export type SwipeGestureEnd = {
  state: SwipeGestureState;
  delta: { dx: number; dy: number } | null;
};

export function createSwipeGestureState(): SwipeGestureState {
  return { kind: "idle" };
}

export function beginSwipeGesture(
  state: SwipeGestureState,
  touches: readonly SwipeTouchPoint[]
): SwipeGestureState {
  if (state.kind === "blocked") return touches.length === 0 ? { kind: "idle" } : state;
  if (state.kind !== "idle" || touches.length !== 1) return { kind: "blocked" };
  const touch = touches[0];
  return {
    kind: "tracking",
    identifier: touch.identifier,
    x: touch.clientX,
    y: touch.clientY
  };
}

export function continueSwipeGesture(
  state: SwipeGestureState,
  touches: readonly SwipeTouchPoint[]
): SwipeGestureState {
  if (state.kind === "idle") return state;
  if (state.kind === "blocked") return touches.length === 0 ? { kind: "idle" } : state;
  if (touches.length === 1 && touches[0].identifier === state.identifier) return state;
  return touches.length === 0 ? { kind: "idle" } : { kind: "blocked" };
}

export function cancelSwipeGesture(touches: readonly SwipeTouchPoint[]): SwipeGestureState {
  return touches.length === 0 ? { kind: "idle" } : { kind: "blocked" };
}

export function endSwipeGesture(
  state: SwipeGestureState,
  activeTouches: readonly SwipeTouchPoint[],
  changedTouches: readonly SwipeTouchPoint[]
): SwipeGestureEnd {
  if (state.kind !== "tracking") {
    return {
      state: activeTouches.length === 0 ? { kind: "idle" } : { kind: "blocked" },
      delta: null
    };
  }
  const ended = changedTouches.find((touch) => touch.identifier === state.identifier);
  if (activeTouches.length !== 0 || changedTouches.length !== 1 || !ended) {
    return {
      state: activeTouches.length === 0 ? { kind: "idle" } : { kind: "blocked" },
      delta: null
    };
  }
  return {
    state: { kind: "idle" },
    delta: { dx: ended.clientX - state.x, dy: ended.clientY - state.y }
  };
}

export function keyToDir(key: string): Dir | null {
  if (key === "ArrowUp" || key === "w" || key === "W") return "up";
  if (key === "ArrowDown" || key === "s" || key === "S") return "down";
  if (key === "ArrowLeft" || key === "a" || key === "A") return "left";
  if (key === "ArrowRight" || key === "d" || key === "D") return "right";
  return null;
}

export function swipeToDir(
  dx: number,
  dy: number,
  minSwipe = 24
): Dir | null {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < minSwipe && absY < minSwipe) return null;
  if (absX > absY) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}
