import { GET } from "@/app/api/games/[id]/replay/route";
import { createSession } from "@/lib/binary2048/sessions";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("GET /api/games/:id/replay", () => {
  const config: Partial<GameConfig> = {
    width: 4,
    height: 4,
    seed: 919
  };
  const initialGrid: Cell[][] = [
    [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ];

  it("returns canonical replay payload (header + moves) for existing game", async () => {
    const session = createSession(config, initialGrid);
    const id = session.current.id;

    const res = await GET(new Request("http://localhost/api/games/x/replay"), {
      params: Promise.resolve({ id })
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.header?.replayVersion).toBe(1);
    expect(json.header?.rulesetId).toBe("binary2048-v1");
    expect(Array.isArray(json.moves)).toBe(true);
    expect(json.moves.length).toBeGreaterThanOrEqual(0);
    expect(json.config).toBeUndefined();
  });

  it("returns 404 for unknown game id", async () => {
    const res = await GET(new Request("http://localhost/api/games/x/replay"), {
      params: Promise.resolve({ id: "missing_game" })
    });
    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.error).toBe("Game not found");
  });
});
