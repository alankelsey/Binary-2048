import { runBotTournament, type BotId } from "@/lib/binary2048/bot-orchestrator";

describe("bot orchestrator", () => {
  it("runs deterministic tournament results for same input", () => {
    const input = {
      seeds: [100, 101],
      maxMoves: 80,
      bots: ["priority", "random", "alternate"] as BotId[]
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
      bots: ["priority", "alternate"]
    });
    expect(result.runs).toHaveLength(6);
    expect(result.ranking).toHaveLength(2);
  });
});
