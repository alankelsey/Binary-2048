import type { Dir } from "@/lib/binary2048/types";

export type ActionCode = "L" | "R" | "U" | "D";
export type AnyAction = Dir | ActionCode;

export function toActionCode(dir: Dir): ActionCode {
  if (dir === "left") return "L";
  if (dir === "right") return "R";
  if (dir === "up") return "U";
  return "D";
}

export function parseAction(input: unknown): Dir | null {
  if (input === "left" || input === "right" || input === "up" || input === "down") return input;
  if (input === "L") return "left";
  if (input === "R") return "right";
  if (input === "U") return "up";
  if (input === "D") return "down";
  return null;
}
