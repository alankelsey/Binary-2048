import type { Dir } from "@/lib/binary2048/types";

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
