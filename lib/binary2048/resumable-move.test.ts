import { requestResumableMove } from "@/lib/binary2048/resumable-move";

describe("requestResumableMove", () => {
  it("restores a stale session and retries the same move once", async () => {
    const requestedIds: string[] = [];
    const recoveryIds: Array<string | undefined> = [];
    const result = await requestResumableMove<
      { error?: string; current?: { turn: number } },
      { id: string }
    >({
      sessionId: "g_stale",
      async requestMove(sessionId, recovery) {
        requestedIds.push(sessionId);
        recoveryIds.push(recovery?.id);
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
    expect(recoveryIds).toEqual([undefined, "g_restored"]);
    expect(result.attempt).toMatchObject({ ok: true, status: 200 });
    expect(result.recoveredSession?.id).toBe("g_restored");
  });

  it("does not retry when recovery is unavailable", async () => {
    const requestMove = jest.fn(async () => ({ ok: false, status: 404, payload: {} }));
    const result = await requestResumableMove<
      { error?: string; current?: { turn: number } },
      { id: string }
    >({
      sessionId: "g_missing",
      requestMove,
      recoverSession: async () => null
    });

    expect(requestMove).toHaveBeenCalledTimes(1);
    expect(result.recoveredSession).toBeNull();
  });

  it("retries one transient failure with the same session and bounded budget", async () => {
    const contexts: Array<{ attempt: number; reason: string }> = [];
    const result = await requestResumableMove<
      { error?: string; current?: { turn: number } },
      { id: string }
    >({
      sessionId: "g_retry",
      async requestMove(_sessionId, _recovery, context) {
        contexts.push(context);
        return context.attempt === 1
          ? { ok: false, status: 503, payload: { error: "temporary" } }
          : { ok: true, status: 200, payload: { current: { turn: 1 } } };
      },
      recoverSession: async () => null,
      retryDelay: async () => undefined
    });

    expect(result.attempt.ok).toBe(true);
    expect(result.requestCount).toBe(2);
    expect(contexts).toEqual([
      { attempt: 1, reason: "initial" },
      { attempt: 2, reason: "transient_retry" }
    ]);
  });

  it("stops after retry exhaustion", async () => {
    const requestMove = jest.fn(async () => ({ ok: false, status: 504, payload: {} }));
    const result = await requestResumableMove({
      sessionId: "g_exhausted",
      requestMove,
      recoverSession: async () => null,
      retryDelay: async () => undefined
    });

    expect(result.attempt.status).toBe(504);
    expect(result.requestCount).toBe(2);
    expect(requestMove).toHaveBeenCalledTimes(2);
  });

  it("waits for reconnect before preserving request order", async () => {
    let online = false;
    const states: string[] = [];
    const requested: string[] = [];
    const result = await requestResumableMove({
      sessionId: "g_offline",
      async requestMove(sessionId) {
        requested.push(sessionId);
        return { ok: true, status: 200, payload: {} };
      },
      recoverSession: async () => null,
      isOnline: () => online,
      async waitUntilOnline() {
        online = true;
      },
      onReliabilityState: (state) => states.push(state)
    });

    expect(result.attempt.ok).toBe(true);
    expect(requested).toEqual(["g_offline"]);
    expect(states).toEqual(["offline_wait", "online"]);
  });

  it("does not retry a precondition conflict", async () => {
    const requestMove = jest.fn(async () => ({ ok: false, status: 409, payload: {} }));
    const result = await requestResumableMove({
      sessionId: "g_conflict",
      requestMove,
      recoverSession: async () => null
    });

    expect(result.attempt.status).toBe(409);
    expect(requestMove).toHaveBeenCalledTimes(1);
  });
});
