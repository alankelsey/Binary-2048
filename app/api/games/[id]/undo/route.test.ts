import { POST } from "@/app/api/games/[id]/undo/route";
import { createSession, moveSession } from "@/lib/binary2048/sessions";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("POST /api/games/:id/undo", () => {
  const baseConfig: Partial<GameConfig> = {
    width: 4,
    height: 4,
    seed: 818,
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

  it("undoes a move and returns undo metadata", async () => {
    const session = createSession(baseConfig, initialGrid);
    const id = session.current.id;
    moveSession(id, "left");

    const req = new Request("http://localhost/api/games/x/undo", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.stepCount).toBe(0);
    expect(json.undo.limit).toBe(2);
    expect(json.undo.used).toBe(1);
    expect(json.undo.remaining).toBe(1);
  });

  it("returns 409 when undo limit is exhausted", async () => {
    const session = createSession(baseConfig, initialGrid);
    const id = session.current.id;
    moveSession(id, "left");
    moveSession(id, "right");
    moveSession(id, "left");

    const req = new Request("http://localhost/api/games/x/undo", { method: "POST" });
    await POST(req, { params: Promise.resolve({ id }) });
    await POST(req, { params: Promise.resolve({ id }) });
    const blocked = await POST(req, { params: Promise.resolve({ id }) });
    const json = await blocked.json();

    expect(blocked.status).toBe(409);
    expect(json.error).toBe("Undo limit reached");
    expect(json.undo.remaining).toBe(0);
  });

  it("returns 404 for missing game id", async () => {
    const req = new Request("http://localhost/api/games/x/undo", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "missing_game" }) });
    expect(res.status).toBe(404);
  });
});
