export type MoveAttempt<TPayload> = {
  ok: boolean;
  status: number;
  payload: TPayload;
};

export async function requestResumableMove<TPayload, TSession extends { id: string }>(input: {
  sessionId: string;
  requestMove: (sessionId: string, recoveredSession?: TSession) => Promise<MoveAttempt<TPayload>>;
  recoverSession: (staleSessionId: string) => Promise<TSession | null>;
}): Promise<{ attempt: MoveAttempt<TPayload>; recoveredSession: TSession | null }> {
  let attempt = await input.requestMove(input.sessionId);
  if (attempt.status !== 404) return { attempt, recoveredSession: null };

  const recoveredSession = await input.recoverSession(input.sessionId);
  if (!recoveredSession) return { attempt, recoveredSession: null };

  attempt = await input.requestMove(recoveredSession.id, recoveredSession);
  return { attempt, recoveredSession };
}
