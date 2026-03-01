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

## API

- `POST /api/games`
  - Body: `{ "config": Partial<GameConfig>, "initialGrid": Cell[][] }` (both optional)
  - Returns created game state
- `GET /api/games/:id`
  - Returns current game state
- `POST /api/games/:id/move`
  - Body: `{ "dir": "up" | "down" | "left" | "right" }`
  - Applies one move and returns updated state
- `GET /api/games/:id/export`
  - Returns export JSON (download attachment)
- `POST /api/sim/run`
  - Body: `{ "config": GameConfig, "initialGrid": Cell[][], "moves": Dir[] }`
  - Runs deterministic scenario and returns export JSON

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
