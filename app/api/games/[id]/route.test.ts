import { GET } from "@/app/api/games/[id]/route";
import { createSession } from "@/lib/binary2048/sessions";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("GET /api/games/:id", () => {
  const config: Partial<GameConfig> = {
    width: 4,
    height: 4,
    seed: 717,
    spawn: {
      pZero: 0,
      pOne: 0.9,
      pWildcard: 0.1,
      wildcardMultipliers: [2]
    }
  };

  const initialGrid: Cell[][] = [
    [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ];

  it("returns session state with undo metadata", async () => {
    const session = createSession(config, initialGrid);
    const id = session.current.id;

    const res = await GET(new Request("http://localhost/api/games/x"), {
      params: Promise.resolve({ id })
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe(id);
    expect(json.current?.id).toBe(id);
    expect(json.stepCount).toBe(0);
    expect(json.undo?.limit).toBe(2);
    expect(json.undo?.remaining).toBe(2);
  });

  it("returns 404 for unknown game id", async () => {
    const res = await GET(new Request("http://localhost/api/games/x"), {
      params: Promise.resolve({ id: "missing_game" })
    });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Game not found");
  });
});
