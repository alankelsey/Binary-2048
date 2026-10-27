import {
  createEmptyScenarioGrid,
  commitScenarioGrid,
  createScenarioGridHistory,
  createScenarioBuilderState,
  placeScenarioTile,
  scenarioSymmetryCoordinates,
  scenarioTileLabel,
  validateScenario,
  redoScenarioGrid,
  undoScenarioGrid,
  resizeScenarioGrid
} from "@/lib/binary2048/scenario-builder";
import type { Cell } from "@/lib/binary2048/types";

describe("scenario builder state", () => {
  it("starts with an independent 4 by 4 empty board and canonical configuration", () => {
    const first = createScenarioBuilderState();
    const second = createScenarioBuilderState();

    expect(first.gameMode).toBe("classic");
    expect(first.symmetry).toBe("none");
    expect(first.config).toMatchObject({ width: 4, height: 4, seed: 42, winTile: 2048 });
    expect(first.grid).toEqual(createEmptyScenarioGrid(4, 4));

    first.config.spawn.wildcardMultipliers.push(16);
    expect(second.config.spawn.wildcardMultipliers).toEqual([2, 4, 8]);
  });

  it("preserves overlapping cells when resizing and fills new cells with empty values", () => {
    const grid: Cell[][] = [
      [{ t: "n", v: 2 }, { t: "z" }],
      [{ t: "w", m: 4 }, { t: "i" }]
    ];

    expect(resizeScenarioGrid(grid, 3, 3)).toEqual([
      [{ t: "n", v: 2 }, { t: "z" }, null],
      [{ t: "w", m: 4 }, { t: "i" }, null],
      [null, null, null]
    ]);
    expect(resizeScenarioGrid(grid, 1, 1)).toEqual([[{ t: "n", v: 2 }]]);
  });

  it("places, replaces, and erases a cell without mutating the source grid", () => {
    const source = createEmptyScenarioGrid(2, 2);
    const placed = placeScenarioTile(source, 0, 1, { t: "w", m: 4 });
    const replaced = placeScenarioTile(placed, 0, 1, { t: "i" });
    const erased = placeScenarioTile(replaced, 0, 1, null);

    expect(source[0][1]).toBeNull();
    expect(placed[0][1]).toEqual({ t: "w", m: 4 });
    expect(replaced[0][1]).toEqual({ t: "i" });
    expect(erased[0][1]).toBeNull();
  });

  it("provides screen-reader labels for every supported tile kind", () => {
    expect([
      scenarioTileLabel(null),
      scenarioTileLabel({ t: "n", v: 8 }),
      scenarioTileLabel({ t: "z" }),
      scenarioTileLabel({ t: "w", m: 4 }),
      scenarioTileLabel({ t: "i" })
    ]).toEqual(["Empty", "Number 8", "Zero", "Wildcard times 4", "Lock-0"]);
  });

  it("places tiles with horizontal, vertical, rotational, and four-way symmetry", () => {
    const empty = createEmptyScenarioGrid(3, 4);

    expect(placeScenarioTile(empty, 0, 0, { t: "n", v: 2 }, "horizontal")).toEqual([
      [{ t: "n", v: 2 }, null, null, { t: "n", v: 2 }],
      [null, null, null, null],
      [null, null, null, null]
    ]);
    expect(placeScenarioTile(empty, 0, 1, { t: "z" }, "vertical")).toEqual([
      [null, { t: "z" }, null, null],
      [null, null, null, null],
      [null, { t: "z" }, null, null]
    ]);
    expect(placeScenarioTile(empty, 0, 0, { t: "i" }, "rotational")).toEqual([
      [{ t: "i" }, null, null, null],
      [null, null, null, null],
      [null, null, null, { t: "i" }]
    ]);
    expect(placeScenarioTile(empty, 0, 0, { t: "w", m: 4 }, "four-way")).toEqual([
      [{ t: "w", m: 4 }, null, null, { t: "w", m: 4 }],
      [null, null, null, null],
      [{ t: "w", m: 4 }, null, null, { t: "w", m: 4 }]
    ]);
  });

  it("deduplicates symmetry coordinates on center axes", () => {
    expect(scenarioSymmetryCoordinates(3, 3, 1, 1, "four-way")).toEqual([[1, 1]]);
    expect(scenarioSymmetryCoordinates(3, 4, 1, 0, "four-way")).toEqual([[1, 0], [1, 3]]);
  });

  it("validates configuration, tiles, wildcard support, and legal moves", () => {
    const scenario = createScenarioBuilderState();
    expect(validateScenario(scenario.config, scenario.grid)).toMatchObject({
      valid: false,
      errors: ["Board must have at least one legal move."],
      legalMoves: []
    });

    const playable = placeScenarioTile(scenario.grid, 0, 0, { t: "n", v: 2 });
    expect(validateScenario(scenario.config, playable)).toMatchObject({
      valid: true,
      errors: [],
      legalMoves: ["down", "right"]
    });

    const invalidConfig = {
      ...scenario.config,
      seed: 0,
      winTile: 3,
      spawn: {
        ...scenario.config.spawn,
        pOne: 0.5,
        wildcardMultipliers: [3]
      }
    };
    const invalidGrid = placeScenarioTile(playable, 0, 1, { t: "w", m: 8 });
    expect(validateScenario(invalidConfig, invalidGrid).errors).toEqual(expect.arrayContaining([
      "Seed must be a positive whole number.",
      "Win tile must be a power of two of at least 2.",
      "Spawn probabilities must total 1.",
      "Wildcard multipliers must be powers of two of at least 2.",
      "Row 1, column 2 uses an unsupported wildcard multiplier."
    ]));

    const blockedConfig = { ...scenario.config, width: 2, height: 2 };
    const blocked: Cell[][] = [
      [{ t: "n", v: 1 }, { t: "n", v: 2 }],
      [{ t: "n", v: 4 }, { t: "n", v: 8 }]
    ];
    expect(validateScenario(blockedConfig, blocked).errors).toContain("Board must have at least one legal move.");
  });

  it("supports commit, undo, redo, and clearing redo after a new edit", () => {
    const empty = createEmptyScenarioGrid(2, 2);
    const first = placeScenarioTile(empty, 0, 0, { t: "n", v: 2 });
    const second = placeScenarioTile(first, 1, 1, { t: "z" });
    const committed = commitScenarioGrid(commitScenarioGrid(createScenarioGridHistory(empty), first), second);

    const undone = undoScenarioGrid(committed);
    expect(undone.present).toEqual(first);
    expect(redoScenarioGrid(undone).present).toEqual(second);

    const replacement = placeScenarioTile(first, 0, 1, { t: "i" });
    expect(commitScenarioGrid(undone, replacement).future).toEqual([]);
    expect(commitScenarioGrid(committed, second)).toBe(committed);
  });
});
