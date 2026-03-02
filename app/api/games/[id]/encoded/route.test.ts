import { GET } from "@/app/api/games/[id]/encoded/route";
import { createSession } from "@/lib/binary2048/sessions";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("GET /api/games/:id/encoded", () => {
  const config: Partial<GameConfig> = {
    width: 4,
    height: 4,
    seed: 303,
    spawn: {
      pZero: 0,
      pOne: 1,
      pWildcard: 0,
      wildcardMultipliers: [2]
    }
  };

  const initialGrid: Cell[][] = [
    [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ];

  it("returns encoded payload fields for bot clients", async () => {
    const session = createSession(config, initialGrid);
    const id = session.current.id;

    const res = await GET(new Request("http://localhost/api/games/x/encoded"), {
      params: Promise.resolve({ id })
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe(id);
    expect(json.actionSpace).toEqual(["L", "R", "U", "D"]);
    expect(Array.isArray(json.legalActions)).toBe(true);
    expect(Array.isArray(json.actionMask)).toBe(true);
    expect(json.actionMask).toHaveLength(4);
    expect(Array.isArray(json.encodedFlat)).toBe(true);
    expect(json.encodedFlat.length).toBe(4 * 4 * 2);
    expect(typeof json.stateHash).toBe("string");
    expect(json.meta?.rulesetId).toBe("binary2048-v1");
  });
});
