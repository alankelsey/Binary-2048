import { stateHash } from "@/lib/binary2048/ai";
import { POST } from "@/app/api/games/[id]/move/route";
import { createSession, getSession } from "@/lib/binary2048/sessions";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("POST /api/games/:id/move hash guard", () => {
  const config: Partial<GameConfig> = {
    width: 4,
    height: 4,
    seed: 909,
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

  it("returns 409 and does not mutate session when expectStateHash is stale", async () => {
    const session = createSession(config, initialGrid);
    const id = session.current.id;
    const before = getSession(id);
    expect(before?.steps.length).toBe(0);

    const req = new Request("http://localhost/api/games/x/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "L", expectStateHash: "deadbeef" })
    });
    const res = await POST(req, { params: Promise.resolve({ id }) });
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("State hash mismatch");
    expect(typeof json.actual).toBe("string");
    expect(getSession(id)?.steps.length).toBe(0);
  });

  it("accepts move when expectStateHash matches current state", async () => {
    const session = createSession(config, initialGrid);
    const id = session.current.id;
    const expected = stateHash(session.current);

    const req = new Request("http://localhost/api/games/x/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "L", expectStateHash: expected })
    });
    const res = await POST(req, { params: Promise.resolve({ id }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.action).toBe("L");
    expect(json.dir).toBe("left");
    expect(json.stepCount).toBe(1);
    expect(typeof json.stateHash).toBe("string");
    expect(getSession(id)?.steps.length).toBe(1);
  });
});
