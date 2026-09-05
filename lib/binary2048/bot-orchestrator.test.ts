import { runBotTournament, type BotId } from "@/lib/binary2048/bot-orchestrator";

describe("bot orchestrator", () => {
  it("runs deterministic tournament results for same input", () => {
    const input = {
      seeds: [100, 101],
      maxMoves: 80,
      bots: ["priority", "random", "alternate", "rollout"] as BotId[]
    };
    const a = runBotTournament(input);
    const b = runBotTournament(input);
    expect(a.ranking).toEqual(b.ranking);
    expect(a.runs).toEqual(b.runs);
  });

  it("returns one run per bot per seed", () => {
    const result = runBotTournament({
      seeds: [210, 211, 212],
      maxMoves: 50,
      bots: ["priority", "alternate", "rollout"]
    });
    expect(result.runs).toHaveLength(9);
    expect(result.ranking).toHaveLength(3);
    expect(result.runs[0]?.trace).toBeUndefined();
  });

  it("captures replayable decision traces when requested", () => {
    const result = runBotTournament({
      seeds: [100],
      maxMoves: 3,
      bots: ["rollout"],
      includeTraces: true
    });
    const run = result.runs[0];
    expect(run?.trace?.complete).toBe(true);
    expect(run?.trace?.actions).toHaveLength(run?.moves ?? 0);
    expect(run?.trace?.decisions).toHaveLength(run?.moves ?? 0);

    const first = run?.trace?.decisions[0] as {
      before: { stateHash: string; legalActions: string[]; candidates: unknown[] };
      decision: { action: string; inputTokens: number; outputTokens: number; fallback: boolean };
      after: { stateHash: string; changed: boolean };
    };
    expect(first.before.stateHash).toBeTruthy();
    expect(first.before.legalActions).toContain(first.decision.action);
    expect(first.before.candidates).toHaveLength(first.before.legalActions.length);
    expect(first.decision).toMatchObject({ inputTokens: 0, outputTokens: 0, fallback: false });
    expect(first.after.stateHash).toBeTruthy();
    expect(first.after.changed).toBe(true);
  });

  it("rollout bot is a stable baseline that is not worse than random on fixed seeds", () => {
    const result = runBotTournament({
      seeds: [300, 301, 302, 303, 304],
      maxMoves: 120,
      bots: ["random", "rollout"]
    });
    const rollout = result.ranking.find((item) => item.bot === "rollout");
    const random = result.ranking.find((item) => item.bot === "random");
    expect(rollout).toBeDefined();
    expect(random).toBeDefined();
    expect((rollout?.avgScore ?? 0) >= (random?.avgScore ?? 0)).toBe(true);
  });
});
