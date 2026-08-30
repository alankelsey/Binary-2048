import { requestResumableMove } from "@/lib/binary2048/resumable-move";

describe("requestResumableMove", () => {
  it("restores a stale session and retries the same move once", async () => {
    const requestedIds: string[] = [];
    const result = await requestResumableMove<
      { error?: string; current?: { turn: number } },
      { id: string }
    >({
      sessionId: "g_stale",
      async requestMove(sessionId) {
        requestedIds.push(sessionId);
        return sessionId === "g_stale"
          ? { ok: false, status: 404, payload: { error: "not found" } }
          : { ok: true, status: 200, payload: { current: { turn: 8 } } };
      },
      async recoverSession(staleSessionId) {
        expect(staleSessionId).toBe("g_stale");
        return { id: "g_restored" };
      }
    });

    expect(requestedIds).toEqual(["g_stale", "g_restored"]);
    expect(result.attempt).toMatchObject({ ok: true, status: 200 });
    expect(result.recoveredSession?.id).toBe("g_restored");
  });

  it("does not retry when recovery is unavailable", async () => {
    const requestMove = jest.fn(async () => ({ ok: false, status: 404, payload: {} }));
    const result = await requestResumableMove({
      sessionId: "g_missing",
      requestMove,
      recoverSession: async () => null
    });

    expect(requestMove).toHaveBeenCalledTimes(1);
    expect(result.recoveredSession).toBeNull();
  });
});
