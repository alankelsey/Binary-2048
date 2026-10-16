export type MoveAttempt<TPayload> = {
  ok: boolean;
  status: number;
  payload: TPayload;
};

export type MoveRequestContext = {
  attempt: number;
  reason: "initial" | "transient_retry" | "recovery_retry";
};

export type MoveReliabilityState = "offline_wait" | "retrying" | "online";

const TRANSIENT_STATUSES = new Set([0, 502, 503, 504]);

export async function requestResumableMove<TPayload, TSession extends { id: string }>(input: {
  sessionId: string;
  requestMove: (
    sessionId: string,
    recoveredSession: TSession | undefined,
    context: MoveRequestContext
  ) => Promise<MoveAttempt<TPayload>>;
  recoverSession: (staleSessionId: string) => Promise<TSession | null>;
  isOnline?: () => boolean;
  waitUntilOnline?: () => Promise<void>;
  retryDelay?: (retryNumber: number) => Promise<void>;
  onReliabilityState?: (state: MoveReliabilityState) => void;
  maxTransientRetries?: number;
}): Promise<{ attempt: MoveAttempt<TPayload>; recoveredSession: TSession | null; requestCount: number }> {
  let requestCount = 0;
  const maxTransientRetries = Math.max(0, input.maxTransientRetries ?? 1);

  const perform = async (
    sessionId: string,
    recoveredSession: TSession | undefined,
    initialReason: MoveRequestContext["reason"]
  ) => {
    let transientRetries = 0;
    while (true) {
      if (input.isOnline && !input.isOnline()) {
        input.onReliabilityState?.("offline_wait");
        if (!input.waitUntilOnline) throw new Error("Offline and no reconnect handler is available");
        await input.waitUntilOnline();
        input.onReliabilityState?.("online");
      }
      requestCount += 1;
      try {
        const attempt = await input.requestMove(sessionId, recoveredSession, {
          attempt: requestCount,
          reason: transientRetries > 0 ? "transient_retry" : initialReason
        });
        if (!TRANSIENT_STATUSES.has(attempt.status) || transientRetries >= maxTransientRetries) {
          return attempt;
        }
      } catch (error) {
        if (transientRetries >= maxTransientRetries) throw error;
      }
      transientRetries += 1;
      input.onReliabilityState?.("retrying");
      await (input.retryDelay?.(transientRetries) ?? Promise.resolve());
    }
  };

  let attempt = await perform(input.sessionId, undefined, "initial");
  if (attempt.status !== 404) return { attempt, recoveredSession: null, requestCount };

  const recoveredSession = await input.recoverSession(input.sessionId);
  if (!recoveredSession) return { attempt, recoveredSession: null, requestCount };

  attempt = await perform(recoveredSession.id, recoveredSession, "recovery_retry");
  return { attempt, recoveredSession, requestCount };
}
