export class EndpointCostCapError extends Error {
  readonly code = "cost_cap_exceeded";
  readonly field: string;
  readonly limit: number;
  readonly value: number;

  constructor(field: string, limit: number, value: number) {
    super(`${field} exceeds max allowed (${limit})`);
    this.name = "EndpointCostCapError";
    this.field = field;
    this.limit = limit;
    this.value = value;
  }
}

export const SIMULATE_MAX_MOVES = 2_000;
export const TOURNAMENT_MAX_MOVES = 2_000;
export const TOURNAMENT_MAX_SEEDS = 100;
