# Binary-2048

Next.js App Router scaffold for a Binary 2048 web game with deterministic simulation APIs.

## Features

- Binary variant rules:
  - `0` annihilates with anything
  - `1 + 1 => 2`, then powers-of-two progression
  - Wildcard tiles `W(k)` multiply number tiles
- Deterministic RNG (`seed + rngStep`) for reproducible scenarios
- In-memory game sessions and export API
- Scenario simulation endpoint for tests

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Controls: swipe on mobile, arrow keys, and `W/A/S/D`.

## API

- `POST /api/games`
  - Body: `{ "config": Partial<GameConfig>, "initialGrid": Cell[][] }` (both optional)
  - Returns created game state
- `GET /api/games/:id`
  - Returns current game state
- `POST /api/games/:id/move`
  - Body: `{ "dir": "up" | "down" | "left" | "right" }` or `{ "action": "L" | "R" | "U" | "D" }`
  - Applies one move and returns updated state
  - AI-friendly fields included in response:
    - `action` (compact move code)
    - `dir` (normalized full direction)
    - `changed` (whether move altered board)
    - `reward` (score delta for move)
    - `done` (game over or won)
    - `spawned` (first spawn event summary when present)
    - `info` (`changed`, `spawned`, `events`, `illegalMove`)
- `POST /api/games/:id/undo`
  - Reverts one move for the current in-memory session
- `GET /api/games/:id/encoded`
  - Returns AI-friendly encoded state + legal moves + ruleset/version metadata
- `GET /api/games/:id/export`
  - Returns export JSON (download attachment)
  - Includes replay-critical metadata: `rulesetId`, `engineVersion`, and compact replay (`seed`, `moves`, `movesApplied`)
- `POST /api/sim/run`
  - Body: `{ "config": GameConfig, "initialGrid": Cell[][], "moves": Dir[] }`
  - Runs deterministic scenario and returns export JSON
- `POST /api/simulate`
  - Body: `{ "seed"?: number, "moves": Array<Dir | "L" | "R" | "U" | "D">, "config"?: Partial<GameConfig> & { size?: number }, "initialGrid"?: Cell[][], "includeSteps"?: boolean }`
  - Runs batch simulation and returns final state, score, and step summaries

## Example Scenario Payload

```json
{
  "config": {
    "width": 4,
    "height": 4,
    "seed": 99,
    "winTile": 2048,
    "zeroBehavior": "annihilate",
    "spawnOnNoopMove": false,
    "spawn": {
      "pZero": 0,
      "pOne": 1,
      "pWildcard": 0,
      "wildcardMultipliers": [2, 4, 8]
    }
  },
  "initialGrid": [
    [{ "t": "w", "m": 2 }, { "t": "w", "m": 2 }, { "t": "n", "v": 1 }, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ],
  "moves": ["left"]
}
```

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE).

## Roadmap Additions

- App theming system: light/dark/theme packs, board backgrounds, and tile style presets.
- Color standards for boosts vs impediments:
  - Boost effects and tiles use green-forward accents.
  - Impediment effects and tiles use warm/red-forward accents.
- Sale item icon system:
  - Define a consistent icon palette and rarity colors for store packs/items.
  - Ensure WCAG contrast compliance for icon + label combinations.
- Replay and undo system:
  - Keep full step logs in exports so users can step forward/backward through any run.
  - Add a replay viewer that can load an exported game and scrub move-by-move.
  - Active-run controls policy:
    - During an active game, hide all options controls except `Export JSON`.
    - During an active game, visible controls should be:
      - `New Game`
      - `Undo`
      - `Export JSON`
  - Add limited undo in live play by difficulty:
    - `Normal`: 2 undos per run
    - `LTFG`: 1 undo per run
    - `Death by AI`: 0 undos per run
  - Support purchasable extra undo charges as boost inventory.
- Import/export and economy integrity:
  - Imported games are treated as `unranked` unless replay hash/signature validation passes.
  - Any replay that contains paid boosts/impediments must include entitlement metadata.
  - Ranked or leaderboard submissions require server-authoritative validation of moves, boosts, and inventory consumption.
- New impediment tile (`Lock-0`) for boost/impede economy:
  - Add an impediment tile that cannot be destroyed on consecutive turns.
  - Rule: it can only be destroyed every other turn (cooldown-gated destruction).
  - After cooldown is satisfied, collision behavior resolves like a `0` tile.
  - Include this in replay/event logs so ranked validation can verify cooldown timing.
- New seeded-chaos mode (`Bitstorm`):
  - Add a mode that starts from a pre-filled board instead of an empty grid.
  - Boards are generated from deterministic seeds to create repeatable challenge runs.
  - Mode name for branding: `Bitstorm` (chaos-style, but consistent with Binary-2048 theme).
  - Expose `Mode` as a dropdown in the gameplay controls row next to `Color`.
- UI controls governance (admin/dev toggle):
  - Add a dev/admin control policy to enable/disable individual dropdowns and advanced controls.
  - In `dev`, default all controls ON for rapid testing.
  - In `prod`, unauthenticated and unpaid users should see:
    - `New Game`
    - `Difficulty`
    - `Color`
    - `Mode`
    - `Import`
    - `Export`
  - Gameplay-state override:
    - If a run is active, temporarily suppress options/dropdowns per active-run controls policy.
- Input support and validation:
  - Movement input must support:
    - `W`, `A`, `S`, `D` keys
    - Arrow keys
    - Mobile swipe gestures
  - Keyboard controls should remain active alongside swipe (not mutually exclusive).
  - Add automated tests verifying all three input paths trigger correct movement behavior and direction mapping.

## AI / Multibot Roadmap

- Deterministic, replayable engine loop:
  - Keep engine pure and deterministic with seeded PRNG only.
  - Standardize step output shape for bot consumers:
    - `state` (next state)
    - `reward` (score delta)
    - `done`
    - `info` (`changed`, `spawned`, `events`, `illegalMove`)
- AI-friendly state encoding:
  - Add fixed-size encoded grid API using 2 channels per cell:
    - `type`: `0=empty`, `1=zero`, `2=number`, `3=wild`
    - `value`: bounded exponent form (`log2` for numbers, multiplier exponent for wildcards)
- Rules/version pinning for reproducible bot evaluation:
  - Include and export `rulesetId`, `engineVersion` (commit SHA), and spawn probabilities.
- Legal move support and no-op policy:
  - Add `legalMoves(state)` and/or expose `changed=false` on no-op moves.
  - Define training policy for no-op moves (penalize or disallow).
- Batch simulation endpoint for scale:
  - Add `POST /api/simulate` to run many moves in one request with seed + config.
  - Return final state/score and optional step summaries for rollouts and MCTS.
- Multibot hooks and runner:
  - Bot contract: input `{ encodedState, legalMoves, meta }`, output `{ action }`.
  - Match runner modes: AI vs AI (same seed), AI vs replay, tournament brackets.
  - Support formats: same-seed race, best-of-N seeds, per-move time budget.
- Reward-shaping telemetry (optional):
  - Track auxiliary metrics such as max tile, empty-cell count, monotonicity, and zero-pressure penalties.
- Near-term API increments (without major re-architecture):
  - `GET /api/games/:id/encoded` -> encoded state + legal moves
  - `POST /api/games/:id/move` -> include `changed`, `reward`, `spawned`, `done`
  - `POST /api/simulate` -> seed + moves + config -> final state/score
  - `GET /api/games/:id/export` -> include replay-critical data (`seed`, `moves`, versions)
- Open product decision:
  - Confirm multibot scope for implementation order:
    - bot swarm/self-play tournaments
    - external integration bots (Discord/Slack)
    - project-specific custom meaning
