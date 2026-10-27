import {
  buildScenarioPracticeRequest,
  createPracticeScenarioMarker,
  parsePracticeScenarioMarker
} from "@/lib/binary2048/scenario-practice";
import { createScenarioBuilderState, placeScenarioTile } from "@/lib/binary2048/scenario-builder";

describe("scenario practice launch", () => {
  it("builds an independent explicitly unranked game request", () => {
    const scenario = createScenarioBuilderState();
    scenario.gameMode = "bitstorm";
    scenario.grid = placeScenarioTile(scenario.grid, 0, 0, { t: "n", v: 8 });
    const request = buildScenarioPracticeRequest(scenario);
    expect(request).toMatchObject({
      mode: "bitstorm",
      economy: { sessionClass: "unranked" },
      config: { seed: 42 }
    });
    expect(request.initialGrid[0]).toEqual([{ t: "n", v: 8 }, null, null, null]);
    request.initialGrid[0][0] = null;
    expect(scenario.grid[0][0]).toEqual({ t: "n", v: 8 });
  });

  it("round trips a bounded versioned practice marker", () => {
    const marker = createPracticeScenarioMarker("g_practice_123", " Opening ", "2026-10-27T12:00:00.000Z");
    expect(marker.name).toBe("Opening");
    expect(parsePracticeScenarioMarker(JSON.stringify(marker))).toEqual(marker);
    expect(parsePracticeScenarioMarker("bad-json")).toBeNull();
    expect(parsePracticeScenarioMarker(JSON.stringify({ ...marker, version: 2 }))).toBeNull();
  });
});
