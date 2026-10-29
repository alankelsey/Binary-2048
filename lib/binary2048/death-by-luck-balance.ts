import { previewDeathByLuckMove } from "@/lib/binary2048/death-by-luck-engine-prototype";
import {
  createDeathByLuckGame,
  deathByLuckActionMask,
  moveDeathByLuckGame,
  type DeathByLuckGame
} from "@/lib/binary2048/death-by-luck-game-prototype";
import { createDeathByLuckDefinition } from "@/lib/binary2048/death-by-luck-prototype";
import type { Cell, Dir } from "@/lib/binary2048/types";

export type DeathByLuckBalanceCandidate = {
  id: string;
  wildcardRate: number;
  wildcardMultipliers: number[];
};

export type DeathByLuckBalanceSummary = DeathByLuckBalanceCandidate & {
  runs: number;
  winRate: number;
  boardFillLossRate: number;
  cappedRate: number;
  moves: Distribution;
  winMoves: Distribution | null;
  lossMoves: Distribution | null;
  score: Distribution;
  maxTile: Distribution;
  seedQuartileWinRateRange: number;
  movesP90P10Ratio: number;
};

export type DeathByLuckFixedSeedResult = DeathByLuckBalanceCandidate & {
  seed: number;
  outcome: "win" | "loss" | "capped";
  moves: number;
  score: number;
  maxTile: number;
};

export type Distribution = { p10: number; p50: number; p90: number; mean: number };

export const DEFAULT_DEATH_BY_LUCK_CANDIDATES: DeathByLuckBalanceCandidate[] = [0.5, 0.65, 0.8].flatMap(
  (wildcardRate) => [[2], [2, 4], [2, 4, 8]].map((wildcardMultipliers) => ({
    id: `w${Math.round(wildcardRate * 100)}-m${wildcardMultipliers.join("-")}`,
    wildcardRate,
    wildcardMultipliers
  }))
);

const DIRECTIONS: Dir[] = ["left", "down", "right", "up"];

export function runDeathByLuckBalanceExperiment(options: {
  candidates?: DeathByLuckBalanceCandidate[];
  seedStart?: number;
  runsPerCandidate?: number;
  moveCap?: number;
  winTile?: number;
} = {}): DeathByLuckBalanceSummary[] {
  const candidates = options.candidates ?? DEFAULT_DEATH_BY_LUCK_CANDIDATES;
  const seedStart = options.seedStart ?? 20_000;
  const runs = options.runsPerCandidate ?? 200;
  const moveCap = options.moveCap ?? 600;
  const winTile = options.winTile ?? 2048;
  return candidates.map((candidate) => summarizeCandidate(candidate, seedStart, runs, moveCap, winTile));
}

export function runDeathByLuckFixedSeedExperiment(options: {
  candidates?: DeathByLuckBalanceCandidate[];
  seeds?: number[];
  moveCap?: number;
  winTile?: number;
} = {}): DeathByLuckFixedSeedResult[] {
  const candidates = options.candidates ?? DEFAULT_DEATH_BY_LUCK_CANDIDATES;
  const seeds = options.seeds ?? [20_000, 20_073, 20_199];
  const moveCap = options.moveCap ?? 600;
  const winTile = options.winTile ?? 2048;
  return candidates.flatMap((candidate) => seeds.map((seed) => ({
    ...candidate,
    wildcardMultipliers: [...candidate.wildcardMultipliers],
    seed,
    ...simulate(candidate, seed, moveCap, winTile)
  })));
}

function summarizeCandidate(
  candidate: DeathByLuckBalanceCandidate,
  seedStart: number,
  runs: number,
  moveCap: number,
  winTile: number
): DeathByLuckBalanceSummary {
  const outcomes = Array.from({ length: runs }, (_, index) =>
    simulate(candidate, seedStart + index, moveCap, winTile)
  );
  const quartileSize = Math.max(1, Math.ceil(runs / 4));
  const quartileWinRates = Array.from({ length: 4 }, (_, quartile) => {
    const slice = outcomes.slice(quartile * quartileSize, Math.min(runs, (quartile + 1) * quartileSize));
    return slice.length === 0 ? 0 : slice.filter((outcome) => outcome.outcome === "win").length / slice.length;
  });
  const moves = distribution(outcomes.map((outcome) => outcome.moves));
  const wins = outcomes.filter((outcome) => outcome.outcome === "win");
  const losses = outcomes.filter((outcome) => outcome.outcome === "loss");
  return {
    ...candidate,
    wildcardMultipliers: [...candidate.wildcardMultipliers],
    runs,
    winRate: rate(outcomes, "win"),
    boardFillLossRate: rate(outcomes, "loss"),
    cappedRate: rate(outcomes, "capped"),
    moves,
    winMoves: wins.length === 0 ? null : distribution(wins.map((outcome) => outcome.moves)),
    lossMoves: losses.length === 0 ? null : distribution(losses.map((outcome) => outcome.moves)),
    score: distribution(outcomes.map((outcome) => outcome.score)),
    maxTile: distribution(outcomes.map((outcome) => outcome.maxTile)),
    seedQuartileWinRateRange: Math.max(...quartileWinRates) - Math.min(...quartileWinRates),
    movesP90P10Ratio: moves.p10 === 0 ? 0 : moves.p90 / moves.p10
  };
}

function simulate(candidate: DeathByLuckBalanceCandidate, seed: number, moveCap: number, winTile: number) {
  const residual = 1 - candidate.wildcardRate;
  const definition = createDeathByLuckDefinition(seed, {
    winTile,
    spawn: {
      pZero: residual * 0.14,
      pOne: residual * 0.8,
      pWildcard: candidate.wildcardRate,
      pLock: residual * 0.06,
      wildcardMultipliers: candidate.wildcardMultipliers
    }
  });
  let game = createDeathByLuckGame(definition, initialGrid(seed));
  while (!game.current.won && !game.current.over && game.current.turn < moveCap) {
    const direction = chooseDirection(game);
    if (!direction) break;
    const result = moveDeathByLuckGame(game, direction);
    if (!result.accepted) break;
    game = result.game;
  }
  return {
    outcome: game.current.won ? "win" as const : game.current.over ? "loss" as const : "capped" as const,
    moves: game.current.turn,
    score: game.current.score,
    maxTile: Math.max(0, ...game.current.grid.flat().map((cell) => cell?.t === "n" ? cell.v : 0))
  };
}

function chooseDirection(game: DeathByLuckGame): Dir | null {
  const mask = deathByLuckActionMask(game);
  let best: { direction: Dir; value: number } | null = null;
  for (const direction of DIRECTIONS) {
    if (!mask[direction]) continue;
    const preview = previewDeathByLuckMove(game.definition, game.current.grid, direction, game.current.turn);
    const empties = preview.grid.flat().filter((cell) => cell === null).length;
    const maxTile = Math.max(0, ...preview.grid.flat().map((cell) => cell?.t === "n" ? cell.v : 0));
    const value = preview.gainedScore * 100 + empties * 10 + maxTile;
    if (!best || value > best.value) best = { direction, value };
  }
  return best?.direction ?? null;
}

function initialGrid(seed: number): Cell[][] {
  const firstColumn = seed % 4;
  const secondColumn = (firstColumn + 2) % 4;
  return Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, column) => {
    if (row === 0 && column === firstColumn) return { t: "n", v: 1 } as const;
    if (row === 1 && column === secondColumn) return { t: "n", v: 1 } as const;
    return null;
  }));
}

function rate(outcomes: Array<{ outcome: "win" | "loss" | "capped" }>, target: "win" | "loss" | "capped") {
  return outcomes.filter((outcome) => outcome.outcome === target).length / outcomes.length;
}

function distribution(values: number[]): Distribution {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    p10: percentile(sorted, 0.1),
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    mean: values.reduce((sum, value) => sum + value, 0) / values.length
  };
}

function percentile(sorted: number[], quantile: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * quantile)))];
}
