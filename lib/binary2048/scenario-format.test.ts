import {
  createScenarioFile,
  parseScenarioFile,
  parseScenarioJson,
  SCENARIO_FILE_FORMAT,
  scenarioFilename
} from "@/lib/binary2048/scenario-format";
import { createScenarioBuilderState } from "@/lib/binary2048/scenario-builder";
import type { Cell } from "@/lib/binary2048/types";

describe("scenario file format", () => {
  it("round trips configuration, seed, every tile type, mode, symmetry, and authoring metadata", () => {
    const scenario = createScenarioBuilderState();
    scenario.gameMode = "bitstorm";
    scenario.symmetry = "four-way";
    scenario.grid[0] = [
      { t: "n", v: 8 },
      { t: "z" },
      { t: "w", m: 4 },
      { t: "i" }
    ] as Cell[];
    const file = createScenarioFile({
      scenario,
      name: "Special opening",
      createdAtISO: "2026-10-27T10:00:00.000Z",
      exportedAtISO: "2026-10-27T11:00:00.000Z"
    });
    const parsed = parseScenarioJson(JSON.stringify(file));

    expect(file).toMatchObject({
      format: SCENARIO_FILE_FORMAT,
      version: 1,
      seed: 42,
      gameMode: "bitstorm",
      symmetry: "four-way",
      authoring: { name: "Special opening", tool: "binary2048-scenario-builder" }
    });
    expect(parsed.scenario).toEqual(scenario);
    expect(parsed.file).toEqual(file);
    expect(file).not.toHaveProperty("moves");
    expect(file).not.toHaveProperty("final");
  });

  it("rejects replay objects, unsupported versions, mismatched seeds, and malformed JSON", () => {
    const file = createScenarioFile({ scenario: createScenarioBuilderState() });
    expect(() => parseScenarioFile({ version: 1, moves: [] })).toThrow("Not a Binary 2048 scenario file.");
    expect(() => parseScenarioFile({ ...file, version: 2 })).toThrow("Unsupported scenario file version: 2.");
    expect(() => parseScenarioFile({ ...file, seed: 99 })).toThrow("Scenario seed does not match its configuration.");
    expect(() => parseScenarioJson("{")).toThrow("Scenario JSON is not valid JSON.");
  });

  it("creates a safe descriptive filename", () => {
    expect(scenarioFilename(" My Opening! ", "2026-10-27T11:00:00.000Z"))
      .toBe("my-opening-2026-10-27T11-00-00-000Z.scenario.json");
  });
});
