import { parseAction, type ActionCode } from "@/lib/binary2048/action";
import { ACTION_SPACE } from "@/lib/binary2048/ai";
import { applyMove, createGame } from "@/lib/binary2048/engine";
import type { Cell, GameConfig, GameState, Tile } from "@/lib/binary2048/types";

export type ExhaustiveHorizonObjective = {
  type: "exhaustive-horizon";
  horizon: number;
  anchor: { row: number; column: number; tile: Tile };
  ranking: ["completed-moves", "anchor-preserved", "empty-cells", "score"];
  optimalActionSequences: ActionCode[][];
};

type RankedOutcome = {
  actions: ActionCode[];
  completedMoves: number;
  anchorPreserved: number;
  emptyCells: number;
  score: number;
};

function sameTile(left: Cell, right: Tile): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function rankOutcome(state: GameState, actions: ActionCode[], objective: ExhaustiveHorizonObjective): RankedOutcome {
  return {
    actions,
    completedMoves: actions.length,
    anchorPreserved: sameTile(state.grid[objective.anchor.row]?.[objective.anchor.column] ?? null, objective.anchor.tile) ? 1 : 0,
    emptyCells: state.grid.flat().filter((cell) => cell === null).length,
    score: state.score
  };
}

function compareOutcomes(left: RankedOutcome, right: RankedOutcome): number {
  return left.completedMoves - right.completedMoves
    || left.anchorPreserved - right.anchorPreserved
    || left.emptyCells - right.emptyCells
    || left.score - right.score;
}

export function exhaustiveOptimalActionSequences(
  config: GameConfig,
  initialGrid: Cell[][],
  objective: ExhaustiveHorizonObjective
): ActionCode[][] {
  const outcomes: RankedOutcome[] = [];

  function visit(state: GameState, actions: ActionCode[]): void {
    if (actions.length === objective.horizon || state.over || state.won) {
      outcomes.push(rankOutcome(state, actions, objective));
      return;
    }

    let advanced = false;
    for (const action of ACTION_SPACE) {
      const dir = parseAction(action);
      if (!dir) continue;
      const result = applyMove(state, dir);
      if (!result.moved) continue;
      advanced = true;
      visit(result.state, [...actions, action]);
    }
    if (!advanced) outcomes.push(rankOutcome(state, actions, objective));
  }

  visit(createGame(config, initialGrid).state, []);
  const best = outcomes.reduce((current, candidate) => compareOutcomes(candidate, current) > 0 ? candidate : current);
  return outcomes
    .filter((outcome) => compareOutcomes(outcome, best) === 0)
    .map((outcome) => outcome.actions)
    .sort((left, right) => left.join("").localeCompare(right.join("")));
}
