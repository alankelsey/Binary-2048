import {
  previewDeathByLuckMove,
  resolveDeathByLuckLine
} from "@/lib/binary2048/death-by-luck-engine-prototype";
import { createDeathByLuckDefinition } from "@/lib/binary2048/death-by-luck-prototype";
import type { Cell } from "@/lib/binary2048/types";

const n = (value: number) => ({ t: "n" as const, v: value });
const w = (multiplier: number) => ({ t: "w" as const, m: multiplier });
const empty = null;
const definition = createDeathByLuckDefinition(9100, { width: 4, height: 2 });

describe("Death by Luck wildcard collision prototype", () => {
  it.each([
    ["equal", w(2), w(2)],
    ["unequal", w(2), w(8)]
  ])("keeps %s wildcard collisions non-combinable", (_name, left, right) => {
    expect(resolveDeathByLuckLine(definition, [left, right, empty, empty])).toEqual({
      line: [left, right, empty, empty],
      moved: false,
      gainedScore: 0
    });
  });

  it.each([
    ["wildcard then number", w(4), n(8)],
    ["number then wildcard", n(8), w(4)]
  ])("preserves multiplication for %s", (_name, left, right) => {
    expect(resolveDeathByLuckLine(definition, [left, right, empty, empty])).toEqual({
      line: [n(32), empty, empty, empty],
      moved: true,
      gainedScore: 32
    });
  });

  it("lets a wildcard blocked by another wildcard multiply a following number", () => {
    expect(resolveDeathByLuckLine(definition, [w(2), w(4), n(8), empty])).toEqual({
      line: [w(2), n(32), empty, empty],
      moved: true,
      gainedScore: 32
    });
  });

  it("applies the rule through grid movement without mutating the source", () => {
    const grid: Cell[][] = [
      [empty, w(2), w(2), empty],
      [empty, w(4), n(8), empty]
    ];
    const snapshot = structuredClone(grid);

    const result = previewDeathByLuckMove(definition, grid, "right");

    expect(result.grid).toEqual([
      [empty, empty, w(2), w(2)],
      [empty, empty, empty, n(32)]
    ]);
    expect(result.gainedScore).toBe(32);
    expect(grid).toEqual(snapshot);
  });

  it("requires the explicit Death by Luck identity at the move boundary", () => {
    expect(() => resolveDeathByLuckLine(
      { ...definition, mode: "classic" } as unknown as typeof definition,
      [w(2), n(2), empty, empty]
    )).toThrow("Explicit Death by Luck mode required");
  });
});
