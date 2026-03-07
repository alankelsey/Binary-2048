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
