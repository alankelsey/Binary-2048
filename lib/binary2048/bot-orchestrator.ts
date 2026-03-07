import { parseAction, toActionCode, type ActionCode } from "@/lib/binary2048/action";
import { legalActionCodes, stateHash } from "@/lib/binary2048/ai";
import { applyMove, createGame, DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Dir, GameConfig, GameState } from "@/lib/binary2048/types";

export type BotId = "priority" | "random" | "alternate" | "rollout";

export type TournamentRun = {
  bot: BotId;
  seed: number;
  score: number;
  moves: number;
  won: boolean;
  over: boolean;
  maxTile: number;
  finalStateHash: string;
};

export type TournamentRanking = {
  bot: BotId;
  games: number;
  avgScore: number;
  avgMoves: number;
  avgMaxTile: number;
  wins: number;
};

export type TournamentRequest = {
  seeds: number[];
  maxMoves: number;
  bots: BotId[];
  config?: Partial<GameConfig>;
};

export type TournamentResult = {
  rulesetId: "binary2048-v1";
  seeds: number[];
  maxMoves: number;
  bots: BotId[];
  ranking: TournamentRanking[];
  runs: TournamentRun[];
};

type BotContext = {
  rand: () => number;
  lastAction: ActionCode | null;
};

type BotPolicy = {
  pick: (state: GameState, legalActions: ActionCode[], ctx: BotContext) => ActionCode | null;
};

const ACTION_SPACE: ActionCode[] = ["U", "L", "R", "D"];

function countEmptyCells(state: GameState) {
  let empty = 0;
  for (const row of state.grid) {
    for (const cell of row) {
      if (cell === null) empty += 1;
    }
  }
  return empty;
}

function evaluateState(state: GameState) {
  const max = maxTile(state);
  const empties = countEmptyCells(state);
  const terminalPenalty = state.over ? -1500 : 0;
  return state.score + max * 12 + empties * 8 + terminalPenalty;
}

function simulateRollout(start: GameState, rand: () => number, rolloutDepth: number) {
  let current = start;
  for (let i = 0; i < rolloutDepth && !current.over && !current.won; i++) {
    const legal = legalActionCodes(current);
    if (legal.length === 0) break;
    const idx = Math.floor(rand() * legal.length);
    const code = legal[idx];
    if (!code) break;
    const dir = parseAction(code) as Dir | null;
    if (!dir) break;
    current = applyMove(current, dir).state;
  }
  return evaluateState(current);
}

export const BOT_IDS = ["priority", "random", "alternate", "rollout"] as const;

const BOT_POLICIES: Record<BotId, BotPolicy> = {
  priority: {
    pick(_state, legalActions) {
      for (const action of ACTION_SPACE) {
        if (legalActions.includes(action)) return action;
      }
      return legalActions[0] ?? null;
    }
  },
  random: {
    pick(_state, legalActions, ctx) {
      if (legalActions.length === 0) return null;
      const idx = Math.floor(ctx.rand() * legalActions.length);
      return legalActions[idx] ?? null;
    }
  },
  alternate: {
    pick(_state, legalActions, ctx) {
      if (legalActions.length === 0) return null;
      const preferred: ActionCode = ctx.lastAction === "L" ? "R" : "L";
      if (legalActions.includes(preferred)) return preferred;
      for (const action of ACTION_SPACE) {
        if (legalActions.includes(action)) return action;
      }
      return legalActions[0] ?? null;
    }
  },
  rollout: {
    pick(state, legalActions, ctx) {
      if (legalActions.length === 0) return null;
      const rolloutsPerAction = 6;
      const rolloutDepth = 10;
      let bestAction: ActionCode | null = null;
      let bestScore = Number.NEGATIVE_INFINITY;
      for (const action of legalActions) {
        const dir = parseAction(action) as Dir | null;
        if (!dir) continue;
        const first = applyMove(state, dir).state;
        let total = evaluateState(first);
        for (let i = 0; i < rolloutsPerAction; i++) {
          total += simulateRollout(first, ctx.rand, rolloutDepth);
        }
        const avgScore = total / (rolloutsPerAction + 1);
        if (avgScore > bestScore) {
          bestScore = avgScore;
          bestAction = action;
        }
      }
      return bestAction ?? legalActions[0] ?? null;
    }
  }
};

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashBotId(bot: string) {
  let hash = 0;
  for (let i = 0; i < bot.length; i++) {
    hash = (hash * 31 + bot.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function maxTile(state: GameState) {
  let max = 0;
  for (const row of state.grid) {
    for (const cell of row) {
      if (cell?.t !== "n") continue;
      max = Math.max(max, cell.v);
    }
  }
  return max;
}

function mergeConfig(config: Partial<GameConfig> | undefined, seed: number): GameConfig {
  return {
    ...DEFAULT_CONFIG,
    ...(config ?? {}),
    seed,
    spawn: {
      ...DEFAULT_CONFIG.spawn,
      ...(config?.spawn ?? {})
    }
  };
}

function runOneGame(bot: BotId, seed: number, maxMoves: number, config?: Partial<GameConfig>): TournamentRun {
  const game = createGame(mergeConfig(config, seed));
  let current = game.state;
  let moves = 0;
  const ctx: BotContext = {
    rand: mulberry32((seed ^ hashBotId(bot)) >>> 0),
    lastAction: null
  };

  while (!current.over && !current.won && moves < maxMoves) {
    const legal = legalActionCodes(current);
    const policy = BOT_POLICIES[bot];
    const action = policy.pick(current, legal, ctx);
    if (!action) break;
    const dir = parseAction(action) as Dir | null;
    if (!dir) break;
    const moved = applyMove(current, dir);
    current = moved.state;
    ctx.lastAction = toActionCode(dir);
    moves += 1;
  }

  return {
    bot,
    seed,
    score: current.score,
    moves: current.turn,
    won: current.won,
    over: current.over,
    maxTile: maxTile(current),
    finalStateHash: stateHash(current)
  };
}

function summarizeRuns(runs: TournamentRun[], bots: BotId[]) {
  const ranking: TournamentRanking[] = [];
  for (const bot of bots) {
    const subset = runs.filter((run) => run.bot === bot);
    const games = subset.length;
    const totalScore = subset.reduce((sum, run) => sum + run.score, 0);
    const totalMoves = subset.reduce((sum, run) => sum + run.moves, 0);
    const totalMaxTile = subset.reduce((sum, run) => sum + run.maxTile, 0);
    ranking.push({
      bot,
      games,
      avgScore: Math.round(totalScore / Math.max(1, games)),
      avgMoves: Math.round(totalMoves / Math.max(1, games)),
      avgMaxTile: Math.round(totalMaxTile / Math.max(1, games)),
      wins: subset.filter((run) => run.won).length
    });
  }
  ranking.sort((a, b) => b.avgScore - a.avgScore || b.avgMaxTile - a.avgMaxTile || a.avgMoves - b.avgMoves);
  return ranking;
}

export function runBotTournament(input: TournamentRequest): TournamentResult {
  const runs: TournamentRun[] = [];
  for (const seed of input.seeds) {
    for (const bot of input.bots) {
      runs.push(runOneGame(bot, seed, input.maxMoves, input.config));
    }
  }
  return {
    rulesetId: "binary2048-v1",
    seeds: input.seeds,
    maxMoves: input.maxMoves,
    bots: input.bots,
    ranking: summarizeRuns(runs, input.bots),
    runs
  };
}
