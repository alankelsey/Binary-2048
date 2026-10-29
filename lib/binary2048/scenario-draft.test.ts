import {
  createScenarioDraft,
  isScenarioBuilderState,
  parseScenarioDrafts,
  SCENARIO_DRAFT_VERSION,
  upsertScenarioDraft
} from "@/lib/binary2048/scenario-draft";
import { createScenarioBuilderState, placeScenarioTile } from "@/lib/binary2048/scenario-builder";

describe("scenario drafts", () => {
  it("creates an independent versioned snapshot and preserves creation time on update", () => {
    const scenario = createScenarioBuilderState();
    scenario.grid = placeScenarioTile(scenario.grid, 0, 0, { t: "n", v: 8 });
    const first = createScenarioDraft({ id: "draft_12345678", name: "  Opening  ", scenario, nowISO: "2026-10-27T10:00:00.000Z" });
    scenario.grid[0][0] = null;
    const updated = createScenarioDraft({ id: first.id, name: "Opening two", scenario, existing: first, nowISO: "2026-10-27T11:00:00.000Z" });

    expect(first).toMatchObject({ draftVersion: SCENARIO_DRAFT_VERSION, name: "Opening", createdAtISO: "2026-10-27T10:00:00.000Z" });
    expect(first.scenario.grid[0][0]).toEqual({ t: "n", v: 8 });
    expect(updated.createdAtISO).toBe(first.createdAtISO);
    expect(updated.updatedAtISO).toBe("2026-10-27T11:00:00.000Z");
  });

  it("parses valid records, rejects corrupt storage, and upserts newest first", () => {
    const scenario = createScenarioBuilderState();
    const older = createScenarioDraft({ id: "draft_abcdefgh", name: "Older", scenario, nowISO: "2026-10-27T10:00:00.000Z" });
    const newer = createScenarioDraft({ id: "draft_ijklmnop", name: "Newer", scenario, nowISO: "2026-10-27T11:00:00.000Z" });
    expect(upsertScenarioDraft([older], newer).map((draft) => draft.name)).toEqual(["Newer", "Older"]);
    expect(parseScenarioDrafts(JSON.stringify([older]))).toEqual([older]);
    expect(parseScenarioDrafts("not-json")).toEqual([]);
    expect(parseScenarioDrafts(JSON.stringify([{ ...older, draftVersion: 99 }]))).toEqual([]);
  });

  it("requires a bounded name and stable safe ID", () => {
    const scenario = createScenarioBuilderState();
    expect(() => createScenarioDraft({ id: "short", name: "Draft", scenario })).toThrow("Draft ID is invalid.");
    expect(() => createScenarioDraft({ id: "draft_12345678", name: "   ", scenario })).toThrow("Draft name is required.");
    expect(createScenarioDraft({ id: "draft_12345678", name: "x".repeat(100), scenario }).name).toHaveLength(80);
  });

  it("accepts every tile schema and rejects malformed tile records", () => {
    const scenario = createScenarioBuilderState();
    scenario.grid[0] = [
      { t: "n", v: 8 },
      { t: "z" },
      { t: "w", m: 4 },
      { t: "i" }
    ];
    expect(isScenarioBuilderState(scenario)).toBe(true);

    for (const invalidCell of [
      { t: "n", v: 0 },
      { t: "w", m: 1 },
      { t: "unknown" }
    ]) {
      const invalid = structuredClone(scenario) as unknown as Record<string, unknown>;
      (invalid.grid as unknown[][])[0][0] = invalidCell;
      expect(isScenarioBuilderState(invalid)).toBe(false);
    }
  });
});
