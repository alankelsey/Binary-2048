import {
  addScenarioToTournamentSet,
  createTournamentScenarioSetFile,
  normalizeTournamentTags,
  tournamentScenarioSetFilename
} from "@/lib/binary2048/scenario-tournament-set";
import { createScenarioBuilderState } from "@/lib/binary2048/scenario-builder";

describe("tournament scenario sets", () => {
  it("creates stable IDs, explicit seeds, normalized tags, and mirrored variants", () => {
    const scenario = createScenarioBuilderState();
    scenario.config.seed = 789;
    scenario.grid[0][0] = { t: "n", v: 2 };
    scenario.grid[1][2] = { t: "w", m: 4 };
    const first = addScenarioToTournamentSet({
      entries: [],
      scenario,
      name: "Opening A",
      tags: " Finals, Special, finals ",
      variants: ["original", "mirror-horizontal", "mirror-vertical", "rotate-180"]
    });
    const second = addScenarioToTournamentSet({
      entries: [],
      scenario,
      name: "Renamed",
      tags: "different",
      variants: ["original", "mirror-horizontal", "mirror-vertical", "rotate-180"]
    });

    expect(first.added).toHaveLength(4);
    expect(first.added.map((entry) => entry.seed)).toEqual([789, 789, 789, 789]);
    expect(first.added[0].tags).toEqual(["finals", "special"]);
    expect(first.added.map((entry) => entry.id)).toEqual(second.added.map((entry) => entry.id));
    expect(first.added[1].initialGrid[0][3]).toEqual({ t: "n", v: 2 });
    expect(first.added[2].initialGrid[3][0]).toEqual({ t: "n", v: 2 });
    expect(first.added[3].initialGrid[3][3]).toEqual({ t: "n", v: 2 });
  });

  it("omits duplicate boards within a variant batch and across additions", () => {
    const scenario = createScenarioBuilderState();
    scenario.grid[0][0] = { t: "n", v: 2 };
    scenario.grid[0][3] = { t: "n", v: 2 };
    const first = addScenarioToTournamentSet({
      entries: [],
      scenario,
      variants: ["original", "mirror-horizontal", "mirror-vertical"]
    });
    expect(first.added).toHaveLength(2);
    expect(first.duplicateCount).toBe(1);

    const again = addScenarioToTournamentSet({ entries: first.entries, scenario });
    expect(again.added).toHaveLength(0);
    expect(again.duplicateCount).toBe(1);
    expect(again.entries).toHaveLength(2);
  });

  it("exports a versioned set whose ID ignores timestamps", () => {
    const scenario = createScenarioBuilderState();
    scenario.grid[0][0] = { t: "n", v: 4 };
    const { entries } = addScenarioToTournamentSet({ entries: [], scenario, name: "Seed board" });
    const first = createTournamentScenarioSetFile({
      entries,
      name: "Autumn cup",
      tags: ["Season 1"],
      createdAtISO: "2026-10-27T10:00:00.000Z",
      exportedAtISO: "2026-10-27T11:00:00.000Z"
    });
    const later = createTournamentScenarioSetFile({
      entries,
      name: "Autumn cup",
      tags: ["season 1"],
      exportedAtISO: "2026-10-28T11:00:00.000Z"
    });

    expect(first).toMatchObject({
      format: "binary2048-tournament-scenario-set",
      version: 1,
      name: "Autumn cup",
      tags: ["season 1"]
    });
    expect(first.id).toBe(later.id);
    expect(() => createTournamentScenarioSetFile({ entries: [] })).toThrow("Add at least one scenario");
    expect(tournamentScenarioSetFilename(first.name, first.exportedAtISO))
      .toBe("autumn-cup-2026-10-27T11-00-00-000Z.tournament-scenarios.json");
    expect(normalizeTournamentTags(" A, b, A ")).toEqual(["a", "b"]);
  });
});
